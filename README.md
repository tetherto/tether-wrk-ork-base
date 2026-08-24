# tether-wrk-ork-base

A base orchestrator service extending from `tether-wrk-base` that orchestrates rack management.

## Introduction

It serves as a central coordinator between app-node and workers to:
- Manage rack registrations and their lifecycle
- Aggregate and process data

The orchestrator handles the following RPC requests:

- `registerRack`: Registers a new rack with the provided details.
- `forgetRacks`: Removes or forgets specified racks.
- `listRacks`: Retrieves a list of racks based on optional filtering criteria.
- `tailLog`: Tail a set of logged data from the racks.

### Setup

To set up the configuration, run:

```bash
./setup-config.sh
```

To install dependencies, run:

```bash
npm install
```

### API

- Register Rack:

  ```bash
    npx hp-rpc-cli -s <RPC_KEY> -m registerRack -d '{ "id": "<ID>", "type": "<TYPE>", "info": { "rpcPublicKey": <RPC_PUBLIC_KEY> } }' -t 1000000
    ```

- List Racks:

    ```bash
    npx hp-rpc-cli -s <RPC_KEY> -m listRacks -d '{ "type": "<TYPE>", "keys": ["<KEY>"] }' -t 1000000
    ```

- Forget Racks:

    ```bash
    npx hp-rpc-cli -s <RPC_KEY> -m forgetRacks -d '{ "ids": [ "<ID>" ], "all": <BOOLEAN> }' -t 1000000
    ```

- Tail Log:

    ```bash
     npx hp-rpc-cli -s <RPC_KEY> -m tailLog -d '{ "type": "<TYPE>", "key": "<KEY>", "tag": "<TAG>" }' -t 1000000
    ```

### Configuration

Since this class extends `tether-wrk-base`, it inherits all configurations from the parent class. If any new functions or features require configuration, updates should be made to `config/common.json` if the settings are shared across all child classes.

In the future, if you need to add a facility, include the facility code in the base class and add the corresponding configuration file in `config/facs/xxx.config.json.example`.

  **Current Configuration Details:**

- **Common Configuration**:
  Configuration is loaded from the `config/common.json` file.
  Example:

  ```json
  {
    "debug": 0,
  }
  ```

  - **`debug`**: Controls the logging level for the worker.

- **Facilities Provided by the Base Class**:
  The following facilities are inherited from the parent class:

  **`hp-svc-facs-store`**:
    Exposes persistent Holepunch datastores. This facility does not require additional configuration files.

  **`hp-svc-facs-net`**:
    Provides access to the Holepunch networking stack (Hyperswarm).
    Configuration is loaded from `config/facs/net.config.json`.
    Example:

    ```json
    {
      "r0": {}
    }
    ```

  - **`allow`**: An optional array used as an allowlist to validate incoming connections based on their `remotePublicKey`. When omitted, all peers are accepted. When set, only listed keys are accepted.
