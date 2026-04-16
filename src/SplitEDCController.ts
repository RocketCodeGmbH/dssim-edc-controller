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
import {Endpoint} from 'dssim-core';
import {EDCController} from './EDCController.js';

export class SplitEDCController extends EDCController {
  private readonly dataplaneHostname: string;

  /**
   * @param hostname Base connector name (e.g. "provider").
   *   Control plane is reached at "${hostname}-cp",
   *   data plane at "${hostname}-dp".
   */
  constructor(
    hostname: string,
    username: string,
    password: string,
    endpoints: Endpoint[]
  ) {
    super(`${hostname}-cp`, username, password, endpoints);
    this.dataplaneHostname = `${hostname}-dp`;
  }

  /**
   * Registers the data plane selector on the control plane's management API,
   * pointing at the data plane pod's control and public endpoints.
   */
  async setHttpDataReceiver(url: string): Promise<void> {
    await this.connectorApi.dataplaneSelectorService.addEntry({
      id: 'http-pull-provider-dataplane',
      url: `http://${this.dataplaneHostname}:8585/control/transfer`,
      allowedSourceTypes: ['HttpData'],
      allowedDestTypes: ['HttpProxy', 'HttpData'],
      properties: {
        publicApiUrl: `http://${this.dataplaneHostname}:8686/public/`,
      },
    });
    this.httpReceiverUrl = url;
  }
}
