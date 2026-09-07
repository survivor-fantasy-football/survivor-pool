import { redirect } from "next/navigation";

export default function Home() {
  // Everything currently lives under /account until later phases add
  // /picks, /standings, /report, and /settings.
  redirect("/account");
}
