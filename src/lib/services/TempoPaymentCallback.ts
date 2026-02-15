/**
 * X-402 Payment Callback for OnChainDB SDK
 * Handles payments via Tempo facilitator using Privy embedded wallets
 * Uses EIP-712 signatures for ERC-3009 transferWithAuthorization
 */

import type {X402PaymentResult, X402Quote} from '@onchaindb/sdk';
import type {EthereumProvider} from '@privy-io/react-auth';

export interface TempoPaymentCallbackOptions {
    provider: EthereumProvider;
    userAddress: string;
    preferredNetwork?: string;
    preferredToken?: string;
}

/**
 * Network configuration for EIP-712 domains
 */
interface NetworkConfig {
    chainId: number;
    usdcAddress: string;
    usdcName: string;
    usdcVersion: string;
}

const NETWORK_CONFIGS: Record<string, NetworkConfig> = {
    'base-sepolia': {
        chainId: 84532,
        usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        usdcName: 'USD Coin',
        usdcVersion: '2',
    },
    'base': {
        chainId: 8453,
        usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        usdcName: 'USD Coin',
        usdcVersion: '2',
    },
    'polygon': {
        chainId: 137,
        usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
        usdcName: 'USD Coin',
        usdcVersion: '2',
    },
    'polygon-amoy': {
        chainId: 80002,
        usdcAddress: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
        usdcName: 'USD Coin',
        usdcVersion: '2',
    },
};

/**
 * Generate a random 32-byte nonce in hex format
 */
function generateNonce(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create EIP-712 typed data for ERC-3009 transferWithAuthorization
 */
function createTransferAuthorizationTypedData(
    config: NetworkConfig,
    authorization: {
        from: string;
        to: string;
        value: string;
        validAfter: number;
        validBefore: number;
        nonce: string;
    }
) {
    return {
        types: {
            EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
                { name: 'verifyingContract', type: 'address' },
            ],
            TransferWithAuthorization: [
                { name: 'from', type: 'address' },
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'validAfter', type: 'uint256' },
                { name: 'validBefore', type: 'uint256' },
                { name: 'nonce', type: 'bytes32' },
            ],
        },
        primaryType: 'TransferWithAuthorization',
        domain: {
            name: config.usdcName,
            version: config.usdcVersion,
            chainId: config.chainId,
            verifyingContract: config.usdcAddress,
        },
        message: {
            from: authorization.from,
            to: authorization.to,
            value: authorization.value,
            validAfter: authorization.validAfter.toString(),
            validBefore: authorization.validBefore.toString(),
            nonce: authorization.nonce,
        },
    };
}

/**
 * Create a payment callback for the OnChainDB SDK
 * This is called automatically when the SDK encounters a 402 Payment Required
 */
export function createTempoPaymentCallback(
    options: TempoPaymentCallbackOptions
): (quote: X402Quote) => Promise<X402PaymentResult> {
    return async (quote: X402Quote): Promise<X402PaymentResult> => {
        console.log('💰 Payment required - SDK quote:', quote);

        // Select payment option based on preferences
        const preferredNetwork = options.preferredNetwork || 'base-sepolia';
        const preferredToken = options.preferredToken || 'native';

        let selectedOption = quote.allOptions.find(opt => {
            const matchesNetwork = opt.network === preferredNetwork;
            const matchesToken =
                (preferredToken === 'native' && opt.asset === 'native') ||
                (preferredToken === 'USDC' && opt.extra?.tokenSymbol === 'USDC') ||
                (preferredToken === 'TIA' && opt.asset === 'utia');

            return matchesNetwork && matchesToken;
        });

        // Fallback to preferred network with any token
        if (!selectedOption) {
            selectedOption = quote.allOptions.find(opt => opt.network === preferredNetwork);
        }

        // Final fallback: use the quote's default option
        if (!selectedOption) {
            selectedOption = quote.allOptions[0];
        }

        if (!selectedOption) {
            throw new Error('No payment options available');
        }

        console.log('💵 Selected payment option:', {
            network: selectedOption.network,
            token: selectedOption.extra?.tokenSymbol || selectedOption.asset,
            amount: selectedOption.maxAmountRequired,
        });

        // For facilitator payments (EVM/Solana), create EIP-712 signature
        if (selectedOption.extra?.paymentMethod === 'x402-facilitator') {
            const networkConfig = NETWORK_CONFIGS[selectedOption.network];

            if (!networkConfig) {
                throw new Error(`Network ${selectedOption.network} not supported for EIP-712 signatures`);
            }

            // Generate authorization parameters
            const validAfter = Math.floor(Date.now() / 1000) - 60; // Valid from 1 minute ago
            const validBefore = Math.floor(Date.now() / 1000) + 300; // Valid for 5 minutes
            const nonce = generateNonce();

            const authorization = {
                from: options.userAddress,
                to: selectedOption.payTo,
                value: selectedOption.maxAmountRequired,
                validAfter,
                validBefore,
                nonce,
            };

            // Create EIP-712 typed data
            const typedData = createTransferAuthorizationTypedData(networkConfig, authorization);

            const tokenDisplay = selectedOption.extra?.tokenSymbol || selectedOption.asset;
            const amountDisplay = selectedOption.extra?.tokenDecimals
                ? (
                    Number(selectedOption.maxAmountRequired) /
                    Math.pow(10, selectedOption.extra.tokenDecimals)
                ).toFixed(6)
                : selectedOption.maxAmountRequired;

            console.log('✍️ Requesting EIP-712 signature from user...');
            console.log('📝 Typed data:', JSON.stringify(typedData, null, 2));

            // Request EIP-712 signature
            const signature = (await options.provider.request({
                method: 'eth_signTypedData_v4',
                params: [options.userAddress, JSON.stringify(typedData)],
            })) as string;

            console.log('✅ User authorized payment with EIP-712 signature');
            console.log('📋 Signature:', signature);
            console.log('📋 Authorization:', authorization);

            // Return authorization to backend - backend will verify via Tempo or submit transaction
            const result: X402PaymentResult = {
                network: selectedOption.network,
                chainType: selectedOption.extra.chainType || 'evm',
                paymentMethod: 'x402-facilitator',
                evmAuthorization: {
                    signature,
                    authorization: {
                        from: authorization.from,
                        to: authorization.to,
                        value: authorization.value,
                        validAfter: authorization.validAfter,
                        validBefore: authorization.validBefore,
                        nonce: authorization.nonce,
                    },
                },
            };

            console.log('📤 Returning EIP-712 authorization to backend');
            return result;
        }

        // For native payments (TIA), return tx hash
        // This shouldn't happen with Tempo, but handle it anyway
        throw new Error('Native TIA payments not supported with Privy - use facilitator');
    };
}
