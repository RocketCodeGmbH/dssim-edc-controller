/* eslint-disable @typescript-eslint/no-unused-vars */
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
  b64encode,
  Offer,
  Representation,
} from 'dssim-core';
import {EDCConnector} from 'edc-lib';
import {DataAddress} from 'edc-lib/management-api/asset-api';
import {ContractRequest} from 'edc-lib/management-api/contract-negotiation-api';
import {v4 as uuid} from 'uuid';
import {UsageRuleMapper} from './UsageRuleMapper.js';

const EDC_NAMESPACE = 'https://w3id.org/edc/v0.0.1/ns/';
const DSP_PROTOCOL = 'dataspace-protocol-http';

/**
 * Controller for EDC (EDC 0.14.1, DataSpace Protocol / management-v3 API).
 * Manages control-plane and data-plane endpoints with scheme/port routing.
 */
export class EDCController implements ConnectorController {
  public connectorApi: EDCConnector;
  private httpReceiverUrl?: string;
  private hostname: string;
  private endpoints: Endpoint[];
  private inCluster: boolean;

  private agreements: {
    [agreementId: string]: {providerUrl: string; assetId: string};
  } = {};

  constructor(
    hostname: string,
    username: string,
    password: string,
    endpoints: Endpoint[]
  ) {
    this.hostname = hostname;
    this.endpoints = endpoints;
    this.inCluster = process.env.INCLUSTER === '1';
    const scheme = this.inCluster ? 'http' : 'https';
    console.log(
      `EDCController: Running ${
        this.inCluster ? 'in-cluster' : 'out-of-cluster'
      }, using ${scheme.toUpperCase()} for EDC API (url: ${scheme}://${hostname})`
    );

    const apiKeyHeader = username || 'X-Api-Key';
    const apiKey = password;

    this.connectorApi = new EDCConnector({
      healthUrl: this.endpointUrl(hostname, 'health'),
      dataPlane: {publicUrl: this.endpointUrl(hostname, 'public')},
      auth: {apiKey, apiKeyHeader},
      controlPlane: {
        managementUrl: this.endpointUrl(hostname, 'management'),
        controlUrl: this.endpointUrl(hostname, 'control'),
      },
    });
  }

  private endpointUrl(host: string, name: string): string {
    const ep = this.endpoints.find(e => e.name === name);
    return this.inCluster
      ? `http://${host}:${ep?.port}${ep?.path}`
      : `https://${host}${ep?.path}`;
  }

  private dspAddress(host: string): string {
    return this.endpointUrl(host, 'protocol');
  }

  private async requestCatalog(
    endPointUrl: string
  ): Promise<Record<string, unknown>> {
    const res =
      await this.connectorApi.controlPlane.catalogService.requestCatalogV3({
        body: {
          '@context': {'@vocab': EDC_NAMESPACE},
          '@type': 'CatalogRequest',
          counterPartyAddress: this.dspAddress(endPointUrl),
          protocol: DSP_PROTOCOL,
        },
      });
    if (res.error) {
      throw new Error(`Catalog request failed: ${JSON.stringify(res.error)}`);
    }
    return (res.data ?? {}) as Record<string, unknown>;
  }

  private extractOffers(catalog: Record<string, unknown>): {
    offerId: string;
    contractOfferId: string;
    assetId: string;
    assetName: string;
    offerPolicy: Record<string, unknown>;
    assigner: string;
  }[] {
    const raw = catalog['dcat:dataset'];
    const datasets = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const participantId = String(
      catalog['dspace:participantId'] ?? catalog['participantId'] ?? ''
    );
    return datasets.map(entry => {
      const dataset = entry as Record<string, unknown>;
      const rawPolicy = dataset['odrl:hasPolicy'];
      const offerPolicy = (
        Array.isArray(rawPolicy) ? rawPolicy[0] : rawPolicy ?? {}
      ) as Record<string, unknown>;
      const assetId = String(dataset['@id'] ?? '');
      const offerId = String(offerPolicy['@id'] ?? '');
      const assetName = String(
        dataset['name'] ?? dataset['edc:name'] ?? assetId
      );
      const assigner = String(offerPolicy['assigner'] ?? participantId);
      return {
        offerId,
        contractOfferId: offerId,
        assetId,
        assetName,
        offerPolicy,
        assigner,
      };
    });
  }

  getDescription(hostname: string): unknown {
    throw new Error('Method not implemented.');
  }

  getArtifactsForAgreement(
    contractAgreementId: string
  ): Promise<{url: string}[]> {
    throw new Error('Method not implemented.');
  }

  downloadArtifact(
    artifactUrl: string,
    forceDownload?: boolean
  ): Promise<unknown> {
    throw new Error('Method not implemented.');
  }

  createValueArtifact(artifact: Artifact, value: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  createDatabaseArtifact(
    artifact: Artifact,
    url: string,
    database: DatabaseType,
    username: string,
    password: string,
    sqlQuery: string
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }

  getFirstArtifact<T>(endPointUrl: string): Promise<T> {
    throw new Error('Method not implemented.');
  }

  async initialize(): Promise<void> {}

  async createHttpEndpointArtifact(
    artifact: Artifact,
    endpointUrl: string,
    mimeType: string,
    apiKey?: {headerKey: string; value: string},
    basicAuth?: {username: string; password: string},
    ressourcePolling?: {delay: number; period: number}
  ): Promise<string> {
    const assetId = uuid();
    const dataAddress = {
      type: 'HttpData',
      name: artifact.name,
      baseUrl: endpointUrl,
    } as DataAddress & {
      baseUrl: string;
      name: string;
      authKey?: string;
      authCode?: string;
    };
    if (basicAuth) {
      dataAddress.authKey = 'Authorization';
      dataAddress.authCode = `Basic ${b64encode(
        `${basicAuth.username}:${basicAuth.password}`
      )}`;
    } else if (apiKey) {
      dataAddress.authKey = apiKey.headerKey;
      dataAddress.authCode = apiKey.value;
    }
    const res = await this.connectorApi.controlPlane.assetService.createAssetV3(
      {
        body: {
          '@context': {'@vocab': EDC_NAMESPACE},
          '@id': assetId,
          properties: {id: assetId, name: artifact.name, contenttype: mimeType},
          dataAddress,
        },
      }
    );
    if (res.error) {
      throw new Error(`Asset creation failed: ${JSON.stringify(res.error)}`);
    }
    return assetId;
  }

  async createOfferForArtifact(
    artifactId: string,
    offer: Offer,
    representation: Representation,
    catalog: {name: string; description?: string},
    policy?: UsagePolicy
  ): Promise<unknown> {
    const policyId = uuid();
    const policyRes =
      await this.connectorApi.controlPlane.policyService.createPolicyDefinitionV3(
        {
          body: {
            '@context': {'@vocab': EDC_NAMESPACE},
            '@id': policyId,
            policy: UsageRuleMapper.mapUsagePolicyRule(artifactId, policy),
          },
        }
      );
    if (policyRes.error) {
      throw new Error(
        `Policy creation failed: ${JSON.stringify(policyRes.error)}`
      );
    }
    const cdRes =
      await this.connectorApi.controlPlane.contractDefinitionService.createContractDefinitionV3(
        {
          body: {
            '@context': {'@vocab': EDC_NAMESPACE},
            '@id': uuid(),
            accessPolicyId: policyId,
            contractPolicyId: policyId,
            assetsSelector: [],
          },
        }
      );
    if (cdRes.error) {
      throw new Error(
        `Contract definition creation failed: ${JSON.stringify(cdRes.error)}`
      );
    }
    return cdRes.data;
  }

  async getAllOffers(endPointUrl: string): Promise<
    {
      offerId: string;
      contractOfferId: string;
      assetId: string;
      assetName: string;
    }[]
  > {
    const catalog = await this.requestCatalog(endPointUrl);
    return this.extractOffers(catalog).map(o => ({
      offerId: o.offerId,
      contractOfferId: o.contractOfferId,
      assetId: o.assetId,
      assetName: o.assetName,
    }));
  }

  async negotiateContract(
    endPointUrl: string,
    offeredRessource: {
      offerId: string;
      contractOfferId: string;
      assetId: string;
      assetName: string;
    }
  ): Promise<{contractId: string}> {
    const counterPartyAddress = this.dspAddress(endPointUrl);
    const catalog = await this.requestCatalog(endPointUrl);
    const offer = this.extractOffers(catalog).find(
      o => o.assetId === offeredRessource.assetId
    );
    if (!offer) {
      throw new Error(
        `No offer found for asset ${offeredRessource.assetId} at ${endPointUrl}`
      );
    }

    const nego =
      await this.connectorApi.controlPlane.contractNegotiationService.initiateContractNegotiationV3(
        {
          body: {
            '@context': {'@vocab': EDC_NAMESPACE},
            counterPartyAddress,
            protocol: DSP_PROTOCOL,
            policy: {
              '@context': 'http://www.w3.org/ns/odrl.jsonld',
              '@id': offer.offerId,
              '@type': 'http://www.w3.org/ns/odrl/2/Offer',
              assigner: offer.assigner,
              target: offer.assetId,
              ...offer.offerPolicy,
            },
          } as ContractRequest,
        }
      );
    if (nego.error) {
      throw new Error(
        `Contract negotiation failed: ${JSON.stringify(nego.error)}`
      );
    }
    const negotiationId = String(nego.data?.['@id'] ?? '');

    let terminated = false;
    await waitFor(async () => {
      const status =
        await this.connectorApi.controlPlane.contractNegotiationService.getNegotiationStateV3(
          {path: {id: negotiationId}}
        );
      const state = status.data?.state;
      if (state === 'TERMINATED') {
        terminated = true;
        return true;
      }
      return state === 'FINALIZED';
    });
    if (terminated) {
      throw new Error(`Contract negotiation ${negotiationId} was terminated`);
    }

    const agreement =
      await this.connectorApi.controlPlane.contractNegotiationService.getAgreementForNegotiationV3(
        {path: {id: negotiationId}}
      );
    const contractId = String(agreement.data?.['@id'] ?? '');
    this.agreements[contractId] = {
      providerUrl: counterPartyAddress,
      assetId: offer.assetId,
    };
    return {contractId};
  }

  async setHttpDataReceiver(url: string): Promise<void> {
    this.httpReceiverUrl = url;
  }

  async transferArtifactsForAgreement(
    contractAgreementId: string
  ): Promise<void> {
    if (!this.httpReceiverUrl) {
      throw new Error(
        'setHttpDataReceiver needs to be called before transferArtifactsForAgreement'
      );
    }
    const agreement = this.agreements[contractAgreementId];
    if (!agreement) {
      throw new Error(
        `No agreement found for ${contractAgreementId}. Call negotiateContract first.`
      );
    }
    const res =
      await this.connectorApi.controlPlane.transferProcessService.initiateTransferProcessV3(
        {
          body: {
            '@context': {'@vocab': EDC_NAMESPACE},
            contractId: contractAgreementId,
            counterPartyAddress: agreement.providerUrl,
            protocol: DSP_PROTOCOL,
            transferType: 'HttpData-PUSH',
            dataDestination: {
              type: 'HttpData',
              baseUrl: this.httpReceiverUrl,
            } as DataAddress & {baseUrl: string},
          },
        }
      );
    if (res.error) {
      throw new Error(
        `Transfer initiation failed: ${JSON.stringify(res.error)}`
      );
    }
  }
}
