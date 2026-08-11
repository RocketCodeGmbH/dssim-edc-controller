/*
 * Copyright 2023 Fraunhofer IEE
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Contributors:
 *       Michel Otto - initial implementation
 *
 */
import {UsagePolicy, UsagePolicyType} from 'dssim-core';

export class UsageRuleMapper {
  static mapUsagePolicyRule(
    assetId: string,
    usagePolicy?: UsagePolicy
  ): Record<string, unknown> {
    if (
      !usagePolicy ||
      usagePolicy.type === UsagePolicyType.UnrestrictedPolicy
    ) {
      return {
        '@context': 'http://www.w3.org/ns/odrl.jsonld',
        '@type': 'Set',
      };
    }
    throw new Error('Usage policy not implemented by connector controller.');
  }
}
