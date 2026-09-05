import type { Metadata } from "next";
import SignupForm from "@/components/auth/SignupForm";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Sign Up",
  description: "Create your Setu account to report hazards and get safe routes in NER",
};

export default function SignupPage() {
  return (
    <main className={styles.authPage}>
      <SignupForm />
    </main>
  );
}
