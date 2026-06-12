// @ts-ignore — untyped JSX draft file
import AccountCreateOneDraft from "@/scratch/milestone.jsx";

const rootFix = `#root { width: 100%; }`;

export default function AccountCreateOne() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: rootFix }} />
      <AccountCreateOneDraft />
    </>
  );
}
