import { readFileSync } from "node:fs";
import path from "node:path";

export const metadata = { title: "SmartSpaces Quote — E2E Review" };

export default function ReviewPage() {
  const html = readFileSync(path.join(process.cwd(), "public", "review-assets", "report.html"), "utf8");
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
