/** Verify a Stellar transaction on Horizon */

const HORIZON_URLS: Record<string, string> = {
  mainnet: "https://horizon.stellar.org",
  testnet: "https://horizon-testnet.stellar.org",
};

function getHorizonUrl(): string {
  const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";
  return HORIZON_URLS[network] ?? HORIZON_URLS.testnet;
}

interface HorizonTx {
  successful: boolean;
  memo?: string;
  source_account: string;
}

interface HorizonPaymentOperation {
  type: string;
  to: string;
  from: string;
  amount: string;
  asset_code?: string;
  asset_type: string; // "native" for XLM
}

export async function verifyGiftPayment(params: {
  txHash: string;
  expectedTo: string;
  expectedAmount: string;
  expectedAsset: string; // e.g. "USDC"
}): Promise<{ valid: boolean; reason?: string }> {
  const { txHash, expectedTo, expectedAmount, expectedAsset } = params;
  const horizonUrl = getHorizonUrl();

  try {
    // Fetch transaction details
    const txRes = await fetch(`${horizonUrl}/transactions/${txHash}`, {
      next: { revalidate: 0 },
    });

    if (!txRes.ok) {
      return { valid: false, reason: "Transaction not found on Stellar network" };
    }

    const tx: HorizonTx = await txRes.json();

    if (!tx.successful) {
      return { valid: false, reason: "Transaction was not successful" };
    }

    // Fetch the operations of this transaction
    const opsRes = await fetch(
      `${horizonUrl}/transactions/${txHash}/operations`,
      { next: { revalidate: 0 } }
    );
    if (!opsRes.ok) {
      return { valid: false, reason: "Could not fetch transaction operations" };
    }

    const ops: { _embedded: { records: HorizonPaymentOperation[] } } =
      await opsRes.json();

    // Look for a payment operation that matches expectations
    const paymentOp = ops._embedded.records.find((op) => {
      if (op.type !== "payment") return false;
      if (op.to !== expectedTo) return false;

      // Check asset
      const assetMatches =
        expectedAsset === "XLM"
          ? op.asset_type === "native"
          : op.asset_code === expectedAsset;

      if (!assetMatches) return false;

      // Check amount (allow small floating point tolerance)
      const paidAmount = parseFloat(op.amount);
      const expected = parseFloat(expectedAmount);
      return Math.abs(paidAmount - expected) < 0.0001;
    });

    if (!paymentOp) {
      return {
        valid: false,
        reason: `No matching payment found (expected ${expectedAmount} ${expectedAsset} to ${expectedTo})`,
      };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Error communicating with Stellar network" };
  }
}
