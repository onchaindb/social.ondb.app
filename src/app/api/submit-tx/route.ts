import { NextRequest, NextResponse } from 'next/server';
import { SigningStargateClient, StargateClient, GasPrice } from '@cosmjs/stargate';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { coins } from '@cosmjs/amino';
import { CELESTIA_CONFIG } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { txData, signedTxBytes, aminoSignature } = body;

    console.log('🚀 Server-side transaction processing:', {
      rpc: CELESTIA_CONFIG.rpc,
      hasSignedBytes: !!signedTxBytes,
      hasAminoSignature: !!aminoSignature,
      hasTxData: !!txData
    });

    if (signedTxBytes) {
      // Option 1: Broadcast pre-signed raw transaction
      const client = await StargateClient.connect(CELESTIA_CONFIG.rpc);
      
      let txBytes;
      if (typeof signedTxBytes === 'string') {
        txBytes = new Uint8Array(signedTxBytes.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      } else {
        txBytes = new Uint8Array(signedTxBytes);
      }
      
      const result = await client.broadcastTx(txBytes);
      
      return NextResponse.json({
        success: result.code === 0,
        txHash: result.transactionHash,
        code: result.code,
        rawLog: result.rawLog,
        gasUsed: result.gasUsed,
        result: result
      });
    
    } else if (txData) {
      // Option 2: Create and broadcast transaction server-side (for POC)
      const { fromAddress, toAddress, amount, memo } = txData;
      
      // Use a dummy wallet for signing (this is just for POC)
      // In production, you'd use the signed bytes from client
      const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"; // Standard test mnemonic
      const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic);
      
      const client = await SigningStargateClient.connectWithSigner(
        CELESTIA_CONFIG.rpc,
        wallet,
        {
          gasPrice: GasPrice.fromString(`0.1${CELESTIA_CONFIG.denom}`) // Use configured denom
        }
      );

      const accounts = await wallet.getAccounts();
      const senderAddress = accounts[0].address;

      console.log('⚠️ Using test wallet for POC:', senderAddress);
      console.log('🔄 Creating transaction with correct gas price...');

      const sendAmount = coins(amount, CELESTIA_CONFIG.denom);
      const fee = {
        amount: coins(50000, CELESTIA_CONFIG.denom), // High fee to ensure acceptance
        gas: "400000",
      };

      const result = await client.sendTokens(
        senderAddress,
        toAddress,
        sendAmount,
        fee,
        memo
      );

      return NextResponse.json({
        success: result.code === 0,
        txHash: result.transactionHash,
        code: result.code,
        rawLog: result.rawLog,
        gasUsed: result.gasUsed,
        result: result,
        note: "Used test wallet for POC - in production use client signing"
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either signedTxBytes or txData required'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Server-side transaction failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}