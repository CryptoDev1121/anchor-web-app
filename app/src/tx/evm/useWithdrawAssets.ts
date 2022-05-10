import { TxResultRendering } from '@libs/app-fns';
import { useRefetchQueries } from '@libs/app-provider';
import { useEvmWallet } from '@libs/evm-wallet';
import { useEvmSdk } from 'crossanchor';
import { ContractReceipt } from 'ethers';
import { useCallback } from 'react';
import { Subject } from 'rxjs';
import { useBackgroundTx } from './useBackgroundTx';
import { TxEvent } from './useTx';
import {
  EVM_ANCHOR_TX_REFETCH_MAP,
  refetchQueryByTxKind,
  TxKind,
  txResult,
} from './utils';

type WithdrawAssetsTxResult = ContractReceipt | null;
type WithdrawAssetsTxRender = TxResultRendering<WithdrawAssetsTxResult>;

export interface WithdrawAssetsTxParams {
  tokenContract: string;
  amount: string;
  symbol: string;
}

export const useWithdrawAssetsTx = () => {
  const { provider, address, connectionType, chainId } = useEvmWallet();

  const xAnchor = useEvmSdk();
  const refetchQueries = useRefetchQueries(EVM_ANCHOR_TX_REFETCH_MAP);

  const withdrawTx = useCallback(
    async (
      txParams: WithdrawAssetsTxParams,
      renderTxResults: Subject<WithdrawAssetsTxRender>,
      txEvents: Subject<TxEvent<WithdrawAssetsTxParams>>,
    ) => {
      try {
        const result = await xAnchor.withdrawAsset(
          address!,
          { contract: txParams.tokenContract },
          {
            handleEvent: (event) => {
              renderTxResults.next(
                txResult(
                  event,
                  connectionType,
                  chainId!,
                  TxKind.WithdrawAssets,
                ),
              );
              txEvents.next({ event, txParams });
            },
          },
        );
        refetchQueries(refetchQueryByTxKind(TxKind.WithdrawAssets));
        return result;
      } catch (error: any) {
        console.log(error);
        throw error;
      }
    },
    [xAnchor, chainId, connectionType, address, refetchQueries],
  );

  const withdrawAssetsTx = useBackgroundTx<
    WithdrawAssetsTxParams,
    WithdrawAssetsTxResult
  >(withdrawTx, parseTx, null, displayTx);

  return provider && connectionType && chainId && address
    ? withdrawAssetsTx
    : undefined;
};

const displayTx = (txParams: WithdrawAssetsTxParams) => ({
  txKind: TxKind.WithdrawAssets,
  amount: `${txParams.amount} ${txParams.symbol}`,
  timestamp: Date.now(),
});

const parseTx = (resp: NonNullable<WithdrawAssetsTxResult>) => resp;
