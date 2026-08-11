import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {Endpoint} from 'dssim-core';
import {EDCController} from './EDCController.js';

const endpoints: Endpoint[] = [
  {name: 'health', path: '/api', port: 9080},
  {name: 'management', path: '/api/management', port: 9081},
  {name: 'control', path: '/api/control', port: 9082},
  {name: 'protocol', path: '/api/v1/dsp', port: 9083},
  {name: 'public', path: '/api/v2/public', port: 7084},
];

const sampleCatalog = {
  'dspace:participantId': 'did:web:provider',
  'dcat:dataset': {
    '@id': 'asset-1',
    name: 'PV data',
    'odrl:hasPolicy': {'@id': 'offer-1', assigner: 'did:web:provider'},
  },
};

function mockConnectorApi() {
  return {
    controlPlane: {
      assetService: {
        createAssetV3: vi.fn().mockResolvedValue({data: {'@id': 'asset-x'}}),
      },
      policyService: {
        createPolicyDefinitionV3: vi
          .fn()
          .mockResolvedValue({data: {'@id': 'policy-x'}}),
      },
      contractDefinitionService: {
        createContractDefinitionV3: vi
          .fn()
          .mockResolvedValue({data: {'@id': 'cd-x'}}),
      },
      catalogService: {requestCatalogV3: vi.fn()},
      contractNegotiationService: {
        initiateContractNegotiationV3: vi.fn(),
        getNegotiationStateV3: vi.fn(),
        getAgreementForNegotiationV3: vi.fn(),
      },
      transferProcessService: {
        initiateTransferProcessV3: vi
          .fn()
          .mockResolvedValue({data: {'@id': 'tp-x'}}),
      },
    },
  };
}

function makeController(api = mockConnectorApi()) {
  const controller = new EDCController('provider', '', 'test-key', endpoints);
  (controller as unknown as {connectorApi: unknown}).connectorApi = api;
  return {controller, api};
}

describe('EDCController construction', () => {
  beforeEach(() => {
    delete process.env.INCLUSTER;
  });
  afterEach(() => {
    delete process.env.INCLUSTER;
  });

  it('constructs out-of-cluster (https) without throwing', () => {
    const {controller} = makeController();
    expect(controller).toBeInstanceOf(EDCController);
  });
});

describe('createHttpEndpointArtifact', () => {
  it('creates an HttpData asset and returns the asset id', async () => {
    const {controller, api} = makeController();
    const id = await controller.createHttpEndpointArtifact(
      {name: 'My Pi Service'},
      'http://pi:8000/ping',
      'plain/text'
    );
    expect(typeof id).toBe('string');
    const body =
      api.controlPlane.assetService.createAssetV3.mock.calls[0][0].body;
    expect(body['@id']).toBe(id);
    expect(body.properties.contenttype).toBe('plain/text');
    expect(body.dataAddress).toMatchObject({
      type: 'HttpData',
      baseUrl: 'http://pi:8000/ping',
    });
  });

  it('encodes basic auth into the data address', async () => {
    const {controller, api} = makeController();
    await controller.createHttpEndpointArtifact(
      {name: 'svc'},
      'http://svc/data',
      'application/json',
      undefined,
      {username: 'u', password: 'p'}
    );
    const body =
      api.controlPlane.assetService.createAssetV3.mock.calls[0][0].body;
    expect(body.dataAddress.authKey).toBe('Authorization');
    expect(body.dataAddress.authCode).toMatch(/^Basic /);
  });

  it('sets an apiKey header into the data address', async () => {
    const {controller, api} = makeController();
    await controller.createHttpEndpointArtifact(
      {name: 'svc'},
      'http://svc/data',
      'application/json',
      {headerKey: 'X-Api-Key', value: 'secret'}
    );
    const body =
      api.controlPlane.assetService.createAssetV3.mock.calls[0][0].body;
    expect(body.dataAddress.authKey).toBe('X-Api-Key');
    expect(body.dataAddress.authCode).toBe('secret');
  });
});

describe('createOfferForArtifact', () => {
  it('creates a policy definition then a contract definition', async () => {
    const {controller, api} = makeController();
    await controller.createOfferForArtifact(
      'asset-1',
      {name: 'Offer', start: new Date(), end: new Date()},
      {mediaType: 'plain/text'},
      {name: 'Catalog'}
    );
    expect(
      api.controlPlane.policyService.createPolicyDefinitionV3
    ).toHaveBeenCalledOnce();
    const cdBody =
      api.controlPlane.contractDefinitionService.createContractDefinitionV3.mock
        .calls[0][0].body;
    const policyBody =
      api.controlPlane.policyService.createPolicyDefinitionV3.mock.calls[0][0]
        .body;
    expect(cdBody.accessPolicyId).toBe(policyBody['@id']);
    expect(cdBody.contractPolicyId).toBe(policyBody['@id']);
    expect(cdBody.assetsSelector).toEqual([]);
  });
});

describe('getAllOffers', () => {
  it('requests the peer catalog at the DSP address and maps datasets', async () => {
    const {controller, api} = makeController();
    api.controlPlane.catalogService.requestCatalogV3.mockResolvedValue({
      data: sampleCatalog,
    });
    const offers = await controller.getAllOffers('provider');
    const body =
      api.controlPlane.catalogService.requestCatalogV3.mock.calls[0][0].body;
    expect(body.counterPartyAddress).toBe('https://provider/api/v1/dsp');
    expect(body.protocol).toBe('dataspace-protocol-http');
    expect(offers).toEqual([
      {
        offerId: 'offer-1',
        contractOfferId: 'offer-1',
        assetId: 'asset-1',
        assetName: 'PV data',
      },
    ]);
  });

  it('handles a dcat:dataset array', async () => {
    const {controller, api} = makeController();
    api.controlPlane.catalogService.requestCatalogV3.mockResolvedValue({
      data: {'dcat:dataset': [sampleCatalog['dcat:dataset']]},
    });
    const offers = await controller.getAllOffers('provider');
    expect(offers).toHaveLength(1);
    expect(offers[0].assetId).toBe('asset-1');
  });
});

describe('negotiateContract', () => {
  it('recovers the offer, negotiates, polls to FINALIZED, returns the agreement id', async () => {
    const {controller, api} = makeController();
    api.controlPlane.catalogService.requestCatalogV3.mockResolvedValue({
      data: sampleCatalog,
    });
    api.controlPlane.contractNegotiationService.initiateContractNegotiationV3.mockResolvedValue(
      {data: {'@id': 'nego-1'}}
    );
    api.controlPlane.contractNegotiationService.getNegotiationStateV3
      .mockResolvedValueOnce({data: {state: 'REQUESTED'}})
      .mockResolvedValueOnce({data: {state: 'FINALIZED'}});
    api.controlPlane.contractNegotiationService.getAgreementForNegotiationV3.mockResolvedValue(
      {data: {'@id': 'agreement-1'}}
    );

    const result = await controller.negotiateContract('provider', {
      offerId: 'offer-1',
      contractOfferId: 'offer-1',
      assetId: 'asset-1',
      assetName: 'PV data',
    });

    expect(result).toEqual({contractId: 'agreement-1'});
    const body =
      api.controlPlane.contractNegotiationService.initiateContractNegotiationV3
        .mock.calls[0][0].body;
    expect(body.counterPartyAddress).toBe('https://provider/api/v1/dsp');
    expect(body.policy.target).toBe('asset-1');
    expect(body.policy['@id']).toBe('offer-1');
  });

  it('throws when the asset is not offered in the catalog', async () => {
    const {controller, api} = makeController();
    api.controlPlane.catalogService.requestCatalogV3.mockResolvedValue({
      data: {'dcat:dataset': []},
    });
    await expect(
      controller.negotiateContract('provider', {
        offerId: 'x',
        contractOfferId: 'x',
        assetId: 'missing',
        assetName: 'x',
      })
    ).rejects.toThrow(/No offer found/);
  });
});

describe('transfer + receiver', () => {
  it('throws if no receiver is set', async () => {
    const {controller} = makeController();
    await expect(
      controller.transferArtifactsForAgreement('a1')
    ).rejects.toThrow(/setHttpDataReceiver/);
  });

  it('pushes HttpData to the receiver for a known agreement', async () => {
    const {controller, api} = makeController();
    (
      controller as unknown as {agreements: Record<string, unknown>}
    ).agreements = {
      a1: {providerUrl: 'https://provider/api/v1/dsp', assetId: 'asset-1'},
    };
    await controller.setHttpDataReceiver('http://receiver:4000/callback');
    await controller.transferArtifactsForAgreement('a1');
    const body =
      api.controlPlane.transferProcessService.initiateTransferProcessV3.mock
        .calls[0][0].body;
    expect(body.contractId).toBe('a1');
    expect(body.counterPartyAddress).toBe('https://provider/api/v1/dsp');
    expect(body.transferType).toBe('HttpData-PUSH');
    expect(body.dataDestination).toMatchObject({
      type: 'HttpData',
      baseUrl: 'http://receiver:4000/callback',
    });
  });
});
