// Minimal Ethereum JSON-RPC client.
// We intentionally use `fetch` instead of ethers Provider because in dev we want
// to call a same-origin relative URL (e.g. /rpc/) through webpack-dev-server proxy.
// ethers v6 requires an absolute URL with protocol for JsonRpcProvider.

type JsonRpcError = {
  code?: number;
  message?: string;
  data?: unknown;
};

type JsonRpcResponse<T> = {
  jsonrpc: '2.0';
  id: number | string;
  result?: T;
  error?: JsonRpcError;
};

export type EthereumRpcTransaction = {
  hash: string;
  from: string;
  to: string | null;
  nonce: string; // hex quantity
  value: string; // hex quantity (wei)
  gas: string; // hex quantity
  gasPrice?: string; // legacy tx
  maxFeePerGas?: string; // EIP-1559 tx
  maxPriorityFeePerGas?: string;
  input: string;
  blockHash: string | null;
  blockNumber: string | null; // hex quantity
  transactionIndex: string | null; // hex quantity
  type?: string; // hex quantity
};

export type EthereumRpcBlock = {
  number: string; // hex quantity
  hash: string;
  parentHash: string;
  timestamp: string; // hex quantity (seconds)
};

export type EthereumRpcTransactionReceipt = {
  transactionHash: string;
  blockNumber: string | null; // hex quantity
  blockHash: string | null;
  status?: string; // hex quantity
};

function getEthereumRpcUrl(): string {
  const url = ((process.env.ETHEREUM_RPC_URL as string | undefined) ?? '').trim();
  if (!url) throw new Error('Не задан ETHEREUM_RPC_URL (Ethereum JSON-RPC endpoint).');
  return url;
}

async function jsonRpcRequest<T>(method: string, params: unknown[]) {
  const url = getEthereumRpcUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ethereum RPC HTTP ${res.status}: ${text || res.statusText}`);
  }

  const data = (await res.json()) as JsonRpcResponse<T>;
  if (data.error) {
    throw new Error(data.error.message || 'Ethereum RPC error');
  }
  return data.result as T;
}

export async function getEthereumTransaction(txHash: string) {
  const hash = txHash.trim();
  if (!hash) throw new Error('txHash is empty');
  const tx = await jsonRpcRequest<EthereumRpcTransaction | null>('eth_getTransactionByHash', [hash]);
  if (!tx) throw new Error('Транзакция не найдена в Ethereum node.');
  return tx;
}

export async function getEthereumBlockByNumber(blockNumberHex: string) {
  const bn = (blockNumberHex ?? '').trim();
  if (!bn) throw new Error('blockNumber is empty');
  const block = await jsonRpcRequest<EthereumRpcBlock | null>('eth_getBlockByNumber', [bn, false]);
  if (!block) throw new Error('Блок не найден в Ethereum node.');
  return block;
}

export async function getEthereumTransactionReceipt(txHash: string) {
  const hash = txHash.trim();
  if (!hash) throw new Error('txHash is empty');
  return jsonRpcRequest<EthereumRpcTransactionReceipt | null>('eth_getTransactionReceipt', [hash]);
}
