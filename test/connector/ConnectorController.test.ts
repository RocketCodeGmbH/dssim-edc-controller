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
import {describe, it} from 'vitest';
import {expect} from 'chai';
import {EDCController} from '../../src/index.js';

describe('Connector Controller - MessagingService', () => {
  const consumer = new EDCController('edcconsumer', 'admin', 'password', [
    {name: 'controller', path: '/api', port: 8181},
    {name: 'ids', path: '/api/v1/ids', port: 8282},
    {name: 'datamanagement', path: '/api/v1/data', port: 8383},
    {name: 'dataplane', path: '/dataplane', port: 8484},
    {name: 'control', path: '/control', port: 8585},
    {name: 'public', path: '/public', port: 8686},
  ]);
  const provider = new EDCController('edcprovider', 'admin', 'password', [
    {name: 'controller', path: '/api', port: 8181},
    {name: 'ids', path: '/api/v1/ids', port: 8282},
    {name: 'datamanagement', path: '/api/v1/data', port: 8383},
    {name: 'dataplane', path: '/dataplane', port: 8484},
    {name: 'control', path: '/control', port: 8585},
    {name: 'public', path: '/public', port: 8686},
  ]);
  const providerUrl = 'http://edcprovider';

  it.skip('Get Offers', async () => {
    const result = await consumer.getAllOffers(`${providerUrl}`);
    console.log(result);
    expect(result).to.not.equal(null);
  });

  it.skip('add datasource Offers', async () => {
    await provider.createHttpEndpointArtifact(
      {
        id: 'data' + Math.random(),
        name: 'HTTP Endpoint data',
        start: new Date(),
        end: new Date(new Date().getFullYear() + 1, 1, 1),
      },
      'https://host/endpoint',
      'application/xml',
      undefined,
      {
        username: 'user',
        password: 'password',
      }
    );
  });

  it.skip('negotiate', async () => {
    const offers = await consumer.getAllOffers(
      `${providerUrl}:8282/api/v1/ids`
    );
    const contractId = await consumer.negotiateContract(
      'http://edcprovider:8282/api/v1/ids/data',
      offers[0]
    );
    console.log(contractId);
  });

  // Live-EDC integration probe: needs a running connector and a prior
  // negotiateContract (skipped above). Skipped like its siblings; unit coverage
  // lives in src/EDCController.test.ts.
  it.skip('transfer', async () => {
    const contractId = await consumer.transferArtifactsForAgreement(
      '1:35776834-8a16-4d07-ac29-aacce4a0da76'
    );
    console.log(contractId);
  });
});
