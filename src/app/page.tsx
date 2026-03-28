// Root redirect — send to landing
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/home");
}
