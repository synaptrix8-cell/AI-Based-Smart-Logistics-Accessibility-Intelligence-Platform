import type { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to Setu - Smart Logistics & Accessibility Platform for NER",
};

export default function LoginPage() {
  return (
    <main className={styles.authPage}>
      <LoginForm />
    </main>
  );
}
