import CrmDashboard from "./CrmDashboard";
import LocationCoverageCard from "./LocationCoverageCard";
import PasswordResetLink from "./PasswordResetLink";

export default function AdminPage() {
  return (
    <>
      <CrmDashboard />
      <LocationCoverageCard />
      <PasswordResetLink />
    </>
  );
}
