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

import {
  ConnectorController,
  Artifact,
  UsagePolicy,
  DatabaseType,
  Endpoint,
  waitFor,
  Offer,
  Representation,
} from 'dssim-core';
import { EDCConnector } from 'edc-lib';

/**
 * Controller for EDC (separated Control Plane and Data Plane)
 * Manages both control plane and data plane endpoints with proper port routing
 */
export class EDCController implements ConnectorController {
  public connectorApi: EDCConnector;
  private httpReceiverUrl?: string;

  private agreements: {
    [agreementId: string]: { providerUrl: string; assetId: string };
  } = {};

  constructor(
    hostname: string,
    username: string,
    password: string,
    endpoints: Endpoint[]
  ) {
    const apiKeyHeader = username || 'X-Api-Key';
    const apiKey = password;

    if (process.env.INCLUSTER === '1') {
      const scheme = 'http';
      console.log('EDCController: Running in-cluster, using HTTP for EDC API (url: ' + scheme + '://' + hostname + ')');
      this.connectorApi = new EDCConnector({
        healthUrl: `${scheme}://${hostname}:${endpoints.find(e => e.name === 'health')?.port}${endpoints.find(e => e.name === 'health')?.path}`,
        dataPlane: {
          publicUrl: `${scheme}://${hostname}:${endpoints.find(e => e.name === 'public')?.port}${endpoints.find(e => e.name === 'public')?.path}`,
        },
        auth: { apiKey, apiKeyHeader },
        controlPlane: {
          managementUrl: `${scheme}://${hostname}:${endpoints.find(e => e.name === 'management')?.port}${endpoints.find(e => e.name === 'management')?.path}`,
          controlUrl: `${scheme}://${hostname}:${endpoints.find(e => e.name === 'control')?.port}${endpoints.find(e => e.name === 'control')?.path}`,
        },
      });
    } else {
      const scheme = 'https';
      console.log('EDCController: Running out-of-cluster, using HTTPS for EDC API (url: ' + scheme + '://' + hostname + ')');
      this.connectorApi = new EDCConnector({
        healthUrl: `${scheme}://${hostname}${endpoints.find(e => e.name === 'health')?.path}`,
        dataPlane: {
          publicUrl: `${scheme}://${hostname}${endpoints.find(e => e.name === 'public')?.path}`,
        },
        auth: { apiKey, apiKeyHeader },
        controlPlane: {
          managementUrl: `${scheme}://${hostname}${endpoints.find(e => e.name === 'management')?.path}`,
          controlUrl: `${scheme}://${hostname}${endpoints.find(e => e.name === 'control')?.path}`,
        },
      });
    }
  }
  getDescription(hostname: string): unknown {
    throw new Error('Method not implemented.');
  }
  getAllOffers(endPointUrl: string): Promise<{ offerId: string; contractOfferId: string; assetId: string; assetName: string; }[]> {
    throw new Error('Method not implemented.');
  }
  getArtifactsForAgreement(contractAgreementId: string): Promise<{ url: string; }[]> {
    throw new Error('Method not implemented.');
  }
  downloadArtifact(artifactUrl: string, forceDownload?: boolean): Promise<unknown> {
    throw new Error('Method not implemented.');
  }
  createValueArtifact(artifact: Artifact, value: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  createHttpEndpointArtifact(artifact: Artifact, endpointUrl: string, mimeType: string, apiKey?: { headerKey: string; value: string; }, basicAuth?: { username: string; password: string; }, ressourcePolling?: { delay: number; period: number; }): Promise<string> {
    throw new Error('Method not implemented.');
  }
  createDatabaseArtifact(artifact: Artifact, url: string, database: DatabaseType, username: string, password: string, sqlQuery: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  createOfferForArtifact(artifactId: string, offer: Offer, representation: Representation, catalog: { name: string; description?: string; }, policy?: UsagePolicy): Promise<unknown> {
    throw new Error('Method not implemented.');
  }
  getFirstArtifact<T>(endPointUrl: string): Promise<T> {
    throw new Error('Method not implemented.');
  }
  setHttpDataReceiver(url: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async initialize(): Promise<void> { }

  async negotiateContract(
    endPointUrl: string,
    offeredRessource: {
      offerId: string;
      contractOfferId: string;
      assetId: string;
      assetName: string;
    },
    counterPartyId?: "test-connector"
  ): Promise<{ contractId: string }> {

    throw new Error('Method not implemented.');
  }

  async transferArtifactsForAgreement(
    contractAgreementId: string
  ): Promise<void> {

    throw new Error('Method not implemented.');
  }
}
