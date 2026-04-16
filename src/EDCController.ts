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
  b64encode,
  waitFor,
} from 'dssim-core';
import {DataAddressDto, EDCConnector} from 'edc-lib';
import {UsageRuleMapper} from './UsageRuleMapper.js';
import {v4 as uuid} from 'uuid';

export class EDCController implements ConnectorController {
  public connectorApi: EDCConnector;
  protected httpReceiverUrl?: string;

  private agreements: {
    [agreementId: string]: {providerUrl: string; assetId: string};
  } = {};
  constructor(
    private hostname: string,
    username: string,
    password: string,
    private endpoints: Endpoint[]
  ) {
    this.connectorApi = new EDCConnector(
      `https://${hostname}${endpoints.find(e => e.name === 'control')?.path}`,
      `https://${hostname}${
        endpoints.find(e => e.name === 'datamanagement')?.path
      }`,
      username,
      password
    );
  }

  async initialize(): Promise<void> {}

  async negotiateContract(
    endPointUrl: string,
    offeredRessource: {
      offerId: string;
      contractOfferId: string;
      assetId: string;
      assetName: string;
    }
  ): Promise<{contractId: string}> {
    const connectorAddress = `${endPointUrl}:${
      this.endpoints.find(e => e.name === 'ids')?.port
    }${this.endpoints.find(e => e.name === 'ids')?.path}/data`;

    const nego =
      await this.connectorApi.contractNegotiationService.initiateContractNegotiation(
        {
          connectorId: 'http-pull-provider',
          connectorAddress: connectorAddress,
          protocol: 'ids-multipart',
          offer: {
            offerId: offeredRessource.offerId,
            assetId: offeredRessource.assetId,
            policy: UsageRuleMapper.mapUsagePolicyRule(
              offeredRessource.assetId
            ),
          },
        }
      );
    console.log(nego);

    let contractAgreementId = '';
    await waitFor(async () => {
      const negoState =
        await this.connectorApi.contractNegotiationService.getNegotiation(
          nego.id!
        );
      if (negoState.state === 'CONFIRMED' && negoState.contractAgreementId) {
        contractAgreementId = negoState.contractAgreementId;
        return true;
      } else {
        return false;
      }
    });
    this.agreements[contractAgreementId] = {
      providerUrl: connectorAddress,
      assetId: offeredRessource.assetId,
    };
    return {contractId: contractAgreementId};
  }

  getArtifactsForAgreement(contractId: string): Promise<{url: string}[]> {
    throw new Error('Method not implemented.');
  }

  downloadArtifact(
    artifactUrl: string,
    forceDownload?: boolean | undefined
  ): Promise<unknown> {
    throw new Error('Method not implemented.');
  }

  async transferArtifactsForAgreement(
    contractAgreementId: string
  ): Promise<void> {
    if (!this.httpReceiverUrl) {
      throw new Error(
        'setHttpDataReceiver needs to be called before transferArtifactsForAgreement'
      );
    } else {
      await this.connectorApi.transferProcessService.initiateTransfer({
        connectorId: 'http-pull-provider',
        connectorAddress: this.agreements[contractAgreementId].providerUrl,
        contractId: contractAgreementId,
        assetId: this.agreements[contractAgreementId].assetId,
        managedResources: false,
        dataDestination: {
          properties: {
            baseUrl: this.httpReceiverUrl,
            type: 'HttpData',
          },
        },
        protocol: 'ids-multipart',
        transferType: {},
      });
    }
  }

  async getAllOffers(providerUrl: string): Promise<
    {
      offerId: string;
      contractOfferId: string;
      assetId: string;
      assetName: string;
    }[]
  > {
    const result = await this.connectorApi.catalogService.requestCatalog({
      providerUrl: `${providerUrl}:${
        this.endpoints.find(e => e.name === 'ids')?.port
      }${this.endpoints.find(e => e.name === 'ids')?.path}/data`,
    });
    console.log(result['contractOffers']![0]);

    return result['contractOffers']!.map(e => {
      return {
        offerId: e.id!,
        contractOfferId: e.id!,
        assetId: e.asset!.id!,
        assetName: e.asset!.properties!['asset:prop:name'],
      };
    });
  }

  getDescription(hostname: string): unknown {
    throw new Error('Method not implemented.');
  }

  createValueArtifact(artifact: Artifact, value: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  async createHttpEndpointArtifact(
    artifact: Artifact,
    endpointUrl: string,
    mimeType: string,
    apiKey?: {headerKey: string; value: string} | undefined,
    basicAuth?: {username: string; password: string} | undefined,
    ressourcePolling?: {delay: number; period: number} | undefined
  ): Promise<string> {
    const dataAddress: DataAddressDto = {
      properties: {
        name: 'Test asset',
        baseUrl: endpointUrl,
        type: 'HttpData',
      },
    };
    if (basicAuth) {
      dataAddress.properties['authKey'] = 'Authorization';
      dataAddress.properties['authCode'] = `Basic ${b64encode(
        `${basicAuth!.username}:${basicAuth!.password}`
      )}`;
    }

    const assetId = uuid();
    await this.connectorApi.assetService.createAsset({
      asset: {
        properties: {
          'asset:prop:id': assetId,
          'asset:prop:name': artifact.name,
          'asset:prop:contenttype': mimeType,
        },
      },
      dataAddress: dataAddress,
    });
    return assetId;
  }

  async createOfferForArtifact(
    artifactId: string,
    offer: {
      name: string;
      description?: string | undefined;
      keywords?: string[] | undefined;
      publisher?: string | undefined;
      language?: string | undefined;
      license?: string | undefined;
      sovereign?: string | undefined;
      start?: Date | undefined;
      end?: Date | undefined;
    },
    representation: {
      name?: string | undefined;
      standard?: string | undefined;
      mediaType: string;
    },
    catalog: {name: string; description?: string | undefined},
    policy?: UsagePolicy | undefined
  ): Promise<unknown> {
    const policyId = uuid();
    const createdPolicy = await this.connectorApi.policyService.createPolicy({
      id: policyId,
      policy: UsageRuleMapper.mapUsagePolicyRule(artifactId),
    });
    console.log(createdPolicy);

    const contracDef =
      await this.connectorApi.contractDefinitionService.createContractDefinition(
        {
          id: uuid(),
          accessPolicyId: policyId,
          contractPolicyId: policyId,
          criteria: [],
        }
      );
    return contracDef;
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

  async getFirstArtifact<T>(endPointUrl: string): Promise<T> {
    throw new Error('Method not implemented.');
  }

  async setHttpDataReceiver(url: string): Promise<void> {
    // Register HTTP Dataplane
    await this.connectorApi.dataplaneSelectorService.addEntry({
      //"edctype": "dataspaceconnector:dataplaneinstance",
      id: 'http-pull-provider-dataplane',
      url: `http://${this.hostname}:${
        this.endpoints.find(e => e.name === 'control')?.port
      }${this.endpoints.find(e => e.name === 'control')?.path}/transfer`,
      allowedSourceTypes: ['HttpData'],
      allowedDestTypes: ['HttpProxy', 'HttpData'],
      properties: {
        publicApiUrl: `http://${this.hostname}:${
          this.endpoints.find(e => e.name === 'public')?.port
        }${this.endpoints.find(e => e.name === 'public')?.path}/`,
      },
    });

    this.httpReceiverUrl = url;
  }
}
