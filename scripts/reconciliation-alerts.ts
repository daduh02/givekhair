import { PrismaClient } from "@prisma/client";
import { getFinanceExceptionRows } from "../src/server/lib/reconciliation";
import { enqueueFinanceExceptionAlert } from "../src/server/lib/queues";

const db = new PrismaClient();

async function main() {
  const charities = await db.charity.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  let queued = 0;
  for (const charity of charities) {
    const rows = await getFinanceExceptionRows({
      scopedCharityIds: [charity.id],
      filters: {},
    });
    const stale = rows.filter((row) => {
      const ageDays = Math.floor((Date.now() - row.relatedDate.getTime()) / 86_400_000);
      return ageDays >= 14;
    });

    if (stale.length > 0) {
      await enqueueFinanceExceptionAlert({
        charityId: charity.id,
        summary: `${charity.name}: ${stale.length} stale reconciliation exception(s) older than 14 days.`,
      });
      queued += 1;
    }
  }

  console.log(`Queued ${queued} reconciliation alert notification(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
