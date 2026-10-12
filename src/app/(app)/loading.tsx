import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Shown while the contract database is being read. */
export default function Loading() {
  return <PageSkeleton tiles={8} />;
}
