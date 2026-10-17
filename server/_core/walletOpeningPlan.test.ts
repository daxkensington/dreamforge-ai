import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
describe("reviewed wallet opening dry-run planner",()=>{
  it("preserves balance, rejects unreviewed or excessive provenance, and never exposes an execution mode",async()=>{
    const directory=await mkdtemp(path.join(tmpdir(),"dreamforge-wallet-plan-"));
    const file=(name:string)=>path.join(directory,name);
    try{
      const wallet={userId:7,balance:77,bonusCredits:500,lifetimeSpent:100,walletAccountingVersion:0,updatedAt:"2026-10-16T00:00:00.000Z",ownerState:"live"};
      await writeFile(file("snapshot.json"),JSON.stringify([wallet]));
      const review={userId:7,approved:true,reviewer:"fixture-reviewer",evidenceTransactionIds:[1,2],expectedBalance:77,expectedBonusCredits:500,expectedLifetimeSpent:100,expectedUpdatedAt:wallet.updatedAt,purchasedRemaining:25};
      let runNumber=0;
      const run=async(reviews:any[])=>{
        const output=file(`plan-${runNumber++}.json`);
        await writeFile(file("reviews.json"),JSON.stringify(reviews));
        execFileSync(process.execPath,[path.resolve("scripts/plan-wallet-opening-balances.mjs"),file("snapshot.json"),file("reviews.json"),output],{stdio:"pipe"});
        return JSON.parse(await readFile(output,"utf8"));
      };
      const valid=await run([review]);
      expect(valid).toMatchObject({dryRun:true,executionSupported:false,releaseBlocked:false});
      expect(valid.plan[0]).toMatchObject({preservedBalance:77,purchasedRemaining:25});
      expect(valid.plan[0].sql).toContain('"walletAccountingVersion" = 0');
      expect(valid.plan[0].sql).not.toContain("SET balance");
      expect((await run([])).releaseBlocked).toBe(true);
      expect((await run([{...review,purchasedRemaining:78}])).releaseBlocked).toBe(true);
      expect((await run([{...review,expectedUpdatedAt:"2026-10-15T00:00:00.000Z"}])).releaseBlocked).toBe(true);
    } finally {
      const resolved=path.resolve(directory);
      if(path.dirname(resolved)===path.resolve(tmpdir())&&path.basename(resolved).startsWith("dreamforge-wallet-plan-")) await rm(resolved,{recursive:true,force:true});
    }
  });
});
