import { describe, expect, it } from 'vitest';
import { composeStructuredDraft, sourceVersion, validateClaimCandidates } from './evidence';
const id = '30000000-0000-4000-8000-000000000001';
const claimId = '50000000-0000-4000-8000-000000000001';
const content = '😀 Acme launched a product.';
const candidate = () => ({ claims: [{ text: 'Acme launched a product.', evidence: [{ documentId: id, sourceVersion: sourceVersion(content), start: 2, end: Array.from(content).length, quote: 'Acme launched a product.', stance: 'SUPPORTS' }] }] });
describe('evidence boundaries', () => {
 it('matches PostgreSQL Unicode code-point spans', () => { expect(validateClaimCandidates(candidate(), [{id,content}]).claims).toHaveLength(1); });
 it.each(['documentId','quote','sourceVersion'])('rejects forged %s', field => { const value = candidate(); Object.assign(value.claims[0]!.evidence[0]!, {[field]: field==='documentId'?'30000000-0000-4000-8000-000000000002':'fabricated'}); expect(()=>validateClaimCandidates(value,[{id,content}])).toThrow(); });
 it('rejects reversed spans and model verification fields', () => { const value=candidate(); value.claims[0]!.evidence[0]!.end=1; expect(()=>validateClaimCandidates(value,[{id,content}])).toThrow(); expect(()=>validateClaimCandidates({...candidate(),verified:true},[{id,content}])).toThrow(); });
 it('composes complete statements from known claims only', () => { const draft={headlineClaimId:claimId,summaryClaimId:claimId,bodyClaimIds:[claimId],category:'technology'}; expect(composeStructuredDraft(draft,[{id:claimId,claim_text:'Reviewed fact.'}])).toEqual({headline:'Reviewed fact.',summary:'Reviewed fact.',body:'Reviewed fact.',category:'technology'}); expect(()=>composeStructuredDraft(draft,[])).toThrow(); });
 it('refuses model-provided prose or empty factual body', () => { expect(()=>composeStructuredDraft({headline:'invented',bodyClaimIds:[]},[])).toThrow(); });
});
