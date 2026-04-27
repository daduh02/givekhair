type CharityLike = {
  isActive: boolean;
  status?: string | null;
};

type AppealLike = {
  status: string;
  visibility: string;
  charity: CharityLike;
};

type TeamLike = {
  status: string;
  visibility: string;
} | null;

type FundraisingPageLike = {
  status: string;
  visibility: string;
  teamId?: string | null;
  appeal: AppealLike;
  team?: TeamLike;
};

function isCharityEligible(charity: CharityLike) {
  return charity.isActive && (charity.status == null || charity.status === "ACTIVE");
}

function isAppealEligible(appeal: AppealLike) {
  return appeal.status === "ACTIVE" && appeal.visibility === "PUBLIC" && isCharityEligible(appeal.charity);
}

function isTeamEligible(team: TeamLike) {
  if (!team) {
    return true;
  }

  return team.status === "ACTIVE" && team.visibility === "PUBLIC";
}

export function isFundraisingPagePubliclyAccessible(page: FundraisingPageLike) {
  return (
    page.status === "ACTIVE" &&
    page.visibility === "PUBLIC" &&
    isAppealEligible(page.appeal) &&
    isTeamEligible(page.team ?? null)
  );
}

export function isFundraisingPageDonationEligible(page: FundraisingPageLike) {
  const eligibleVisibility =
    page.visibility === "PUBLIC" ||
    (page.visibility === "HIDDEN" && (page.teamId ?? null) === null);

  return (
    page.status === "ACTIVE" &&
    eligibleVisibility &&
    isAppealEligible(page.appeal) &&
    isTeamEligible(page.team ?? null)
  );
}
