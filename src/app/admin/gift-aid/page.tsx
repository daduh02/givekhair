import Link from "next/link";
export default function Page() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-2" style={{ color: "#233029" }}>gift-aid</h1>
      <p className="text-sm mb-6" style={{ color: "#8A9E94" }}>Full management coming soon.</p>
      <Link href="/admin" className="btn-outline" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>← Back to overview</Link>
    </div>
  );
}
