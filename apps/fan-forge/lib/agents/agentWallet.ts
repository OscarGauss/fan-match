import {
  Horizon,
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
  Asset,
  BASE_FEE,
} from '@stellar/stellar-sdk';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function getKeypair(agentId: 'red' | 'blue'): Keypair {
  const secret =
    agentId === 'red'
      ? getEnv('AGENT_RED_SECRET')
      : getEnv('AGENT_BLUE_SECRET');
  return Keypair.fromSecret(secret);
}

function getServer(): Horizon.Server {
  const url = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
  return new Horizon.Server(url);
}

function getUSDCAsset(): Asset {
  return new Asset('USDC', getEnv('USDC_ISSUER'));
}

// ── Exported functions ────────────────────────────────────────────────────────

/** Returns the public key for the given agent from env. */
export function getAgentPublicKey(agentId: 'red' | 'blue'): string {
  return agentId === 'red'
    ? getEnv('AGENT_RED_PUBLIC')
    : getEnv('AGENT_BLUE_PUBLIC');
}

/** Fetches real USDC balance from Horizon. Returns 0 on any error. */
export async function getAgentUSDCBalance(
  agentId: 'red' | 'blue',
): Promise<number> {
  try {
    const server = getServer();
    const publicKey = getAgentPublicKey(agentId);
    const usdc = getUSDCAsset();

    const account = await server.loadAccount(publicKey);
    const balance = account.balances.find(
      (b) =>
        b.asset_type === 'credit_alphanum4' &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === usdc.getCode() &&
        (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === usdc.getIssuer(),
    );

    return balance ? parseFloat(balance.balance) : 0;
  } catch {
    return 0;
  }
}

/**
 * Signs and submits a USDC payment from an agent wallet.
 * Returns success flag, tx hash on success, or error message on failure.
 */
export async function agentSendUSDC(
  agentId: 'red' | 'blue',
  toAddress: string,
  amount: string,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const server = getServer();
    const keypair = getKeypair(agentId);
    const usdc = getUSDCAsset();

    const account = await server.loadAccount(keypair.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: toAddress,
          asset: usdc,
          amount,
        }),
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    const result = await server.submitTransaction(tx);
    return { success: true, txHash: result.hash };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Fetches the last 5 USDC payments sent TO the agent within the last 90 seconds.
 */
export async function getRecentPaymentsToAgent(
  agentId: 'red' | 'blue',
): Promise<{ from: string; amount: string; txHash: string }[]> {
  try {
    const server = getServer();
    const publicKey = getAgentPublicKey(agentId);
    const usdc = getUSDCAsset();
    const cutoff = Date.now() - 90_000;

    const records = await server
      .payments()
      .forAccount(publicKey)
      .limit(20)
      .order('desc')
      .call();

    const results: { from: string; amount: string; txHash: string }[] = [];

    for (const record of records.records) {
      if (results.length >= 5) break;

      // Only payment operations
      if (record.type !== 'payment') continue;

      const payment = record as Horizon.HorizonApi.PaymentOperationResponse;

      // Must be USDC
      if (
        payment.asset_type !== 'credit_alphanum4' ||
        payment.asset_code !== usdc.getCode() ||
        payment.asset_issuer !== usdc.getIssuer()
      ) {
        continue;
      }

      // Must be TO the agent
      if (payment.to !== publicKey) continue;

      // Must be within last 90 seconds
      const createdAt = new Date(payment.created_at).getTime();
      if (createdAt < cutoff) continue;

      results.push({
        from: payment.from,
        amount: payment.amount,
        txHash: payment.transaction_hash,
      });
    }

    return results;
  } catch {
    return [];
  }
}
