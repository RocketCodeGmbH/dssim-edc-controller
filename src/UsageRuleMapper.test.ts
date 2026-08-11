import {describe, it, expect} from 'vitest';
import {UsageRuleMapper} from './UsageRuleMapper.js';
import {UnrestrictedPolicy, NumberUsagesRestricted} from 'dssim-core';

describe('UsageRuleMapper', () => {
  it('maps undefined to an unrestricted ODRL Set policy', () => {
    const policy = UsageRuleMapper.mapUsagePolicyRule('asset-1');
    expect(policy['@context']).toBe('http://www.w3.org/ns/odrl.jsonld');
    expect(policy['@type']).toBe('Set');
  });

  it('maps UnrestrictedPolicy to an ODRL Set policy', () => {
    const policy = UsageRuleMapper.mapUsagePolicyRule(
      'asset-1',
      new UnrestrictedPolicy()
    );
    expect(policy['@type']).toBe('Set');
  });

  it('throws for unsupported policy types', () => {
    expect(() =>
      UsageRuleMapper.mapUsagePolicyRule(
        'asset-1',
        new NumberUsagesRestricted(3)
      )
    ).toThrow('Usage policy not implemented by connector controller.');
  });
});
