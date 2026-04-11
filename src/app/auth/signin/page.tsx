import { Suspense } from "react";
import SignInForm from "./SignInForm";

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#F6F1E8" }} />}>
      <SignInForm />
    </Suspense>
  );
}
