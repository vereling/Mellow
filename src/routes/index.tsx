import { Studio } from "@/components/studio/Studio";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Studio />;
}
