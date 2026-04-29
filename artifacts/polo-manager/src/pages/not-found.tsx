import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
      <h1 className="font-display text-6xl font-extrabold text-g900 mb-4 tracking-tighter">404</h1>
      <p className="text-[16px] text-ink2 font-sans mb-8">The page you're looking for doesn't exist.</p>
      <Button asChild>
        <Link href="/">Return Home</Link>
      </Button>
    </div>
  );
}
