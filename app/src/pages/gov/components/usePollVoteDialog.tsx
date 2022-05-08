import {
  ANC_INPUT_MAXIMUM_DECIMAL_POINTS,
  ANC_INPUT_MAXIMUM_INTEGER_POINTS,
  formatUST,
  formatVeAnc,
  formatVeAncInput,
} from '@anchor-protocol/notation';
import { u, veANC } from '@anchor-protocol/types';
import { useGovVoteAvailableQuery } from '@anchor-protocol/app-provider';
import { useAnchorBank } from '@anchor-protocol/app-provider/hooks/useAnchorBank';
import { useFixedFee } from '@libs/app-provider';
import { demicrofy, microfy } from '@libs/formatter';
import { ActionButton } from '@libs/neumorphism-ui/components/ActionButton';
import { Dialog } from '@libs/neumorphism-ui/components/Dialog';
import { IconSpan } from '@libs/neumorphism-ui/components/IconSpan';
import { NumberInput } from '@libs/neumorphism-ui/components/NumberInput';
import { flat } from '@libs/styled-neumorphism';
import { DialogProps, OpenDialog, useDialog } from '@libs/use-dialog';
import { InputAdornment, Modal } from '@material-ui/core';
import { ThumbDownOutlined, ThumbUpOutlined } from '@material-ui/icons';
import { StreamStatus } from '@rx-stream/react';
import big from 'big.js';
import { MessageBox } from 'components/MessageBox';
import { TxFeeList, TxFeeListItem } from 'components/TxFeeList';
import { TxResultRenderer } from 'components/tx/TxResultRenderer';
import { useAccount } from 'contexts/account';
import { validateTxFee } from '@anchor-protocol/app-fns';
import React, {
  ChangeEvent,
  ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import styled from 'styled-components';
import { VEANC_SYMBOL } from '@anchor-protocol/token-symbols';
import { useMyVotingPowerQuery } from 'queries';
import { VStack } from '@libs/ui/Stack';
import { AmountSlider, SliderPlaceholder } from 'components/sliders';
import { useVoteTx } from 'tx/terra';

interface FormParams {
  className?: string;
  pollId: number;
}

type FormReturn = void;

export function usePollVoteDialog(): [
  OpenDialog<FormParams, FormReturn>,
  ReactNode,
] {
  return useDialog(Component);
}

function ComponentBase({
  className,
  closeDialog,
  pollId,
}: DialogProps<FormParams, FormReturn>) {
  const [vote, voteResult] = useVoteTx();

  const { connected } = useAccount();

  const fixedFee = useFixedFee();

  const bank = useAnchorBank();

  const { data: votingPower = '0' as u<veANC> } = useMyVotingPowerQuery();

  const canIVote = useGovVoteAvailableQuery(pollId);

  const [voteFor, setVoteFor] = useState<null | 'yes' | 'no'>(null);

  const [amount, setAmount] = useState<veANC>('0' as veANC);

  const invalidTxFee = useMemo(
    () => connected && validateTxFee(bank.tokenBalances.uUST, fixedFee),
    [bank, fixedFee, connected],
  );

  const invalidAmount = useMemo(() => {
    if (amount.length === 0 || !connected) return undefined;

    const uVeAnc = microfy(amount);

    return votingPower && uVeAnc.gt(votingPower)
      ? 'Not enough assets'
      : undefined;
  }, [amount, connected, votingPower]);

  const txFee = fixedFee;

  const submit = useCallback(
    (voteFor: 'yes' | 'no', amount: veANC) => {
      if (!connected || !vote) {
        return;
      }

      vote({
        pollId,
        voteFor,
        amount,
      });
    },
    [connected, pollId, vote],
  );

  if (
    voteResult?.status === StreamStatus.IN_PROGRESS ||
    voteResult?.status === StreamStatus.DONE
  ) {
    return (
      <Modal open disableBackdropClick disableEnforceFocus>
        <Dialog className={className}>
          <TxResultRenderer
            resultRendering={voteResult.value}
            onExit={closeDialog}
          />
        </Dialog>
      </Modal>
    );
  }

  return (
    <Modal open onClose={() => closeDialog()}>
      <Dialog className={className} onClose={() => closeDialog()}>
        <h1>Vote</h1>

        <MessageBox
          level="info"
          hide={{ id: 'vote', period: 1000 * 60 * 60 * 24 * 7 }}
        >
          Vote cannot be changed after submission. Staked {VEANC_SYMBOL} used to
          vote in polls are locked and cannot be withdrawn until the poll
          finishes.
        </MessageBox>

        {!!invalidTxFee && <MessageBox>{invalidTxFee}</MessageBox>}

        <ul className="vote">
          <li
            data-vote="yes"
            data-selected={voteFor === 'yes'}
            onClick={() => setVoteFor('yes')}
          >
            <i>
              <ThumbUpOutlined />
            </i>
            <span>YES</span>
          </li>
          <li
            data-vote="no"
            data-selected={voteFor === 'no'}
            onClick={() => setVoteFor('no')}
          >
            <i>
              <ThumbDownOutlined />
            </i>
            <span>NO</span>
          </li>
        </ul>

        <VStack fullWidth gap={40}>
          <VStack fullWidth gap={4}>
            <NumberInput
              className="amount"
              value={amount}
              maxIntegerPoinsts={ANC_INPUT_MAXIMUM_INTEGER_POINTS}
              maxDecimalPoints={ANC_INPUT_MAXIMUM_DECIMAL_POINTS}
              label="AMOUNT"
              onChange={({ target }: ChangeEvent<HTMLInputElement>) =>
                setAmount(target.value as veANC)
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">{VEANC_SYMBOL}</InputAdornment>
                ),
              }}
            />
            <div className="wallet" aria-invalid={!!invalidAmount}>
              <span>{invalidAmount}</span>
              <span>
                Balance:{' '}
                <span
                  style={{
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                  onClick={() =>
                    votingPower &&
                    setAmount(formatVeAncInput(demicrofy(votingPower)))
                  }
                >
                  {votingPower ? formatVeAnc(demicrofy(votingPower)) : 0}{' '}
                  {VEANC_SYMBOL}
                </span>
              </span>
            </div>
          </VStack>
          {connected && votingPower ? (
            <AmountSlider
              max={Number(demicrofy(votingPower))}
              value={Number(amount)}
              onChange={(value) => {
                setAmount(formatVeAncInput(value.toString() as veANC));
              }}
              symbol={VEANC_SYMBOL}
            />
          ) : (
            <SliderPlaceholder />
          )}
          {txFee && (
            <TxFeeList className="receipt">
              <TxFeeListItem label={<IconSpan>Tx Fee</IconSpan>}>
                {formatUST(demicrofy(txFee))} UST
              </TxFeeListItem>
            </TxFeeList>
          )}
        </VStack>

        <ActionButton
          className="submit"
          disabled={
            !connected ||
            !canIVote ||
            !vote ||
            amount.length === 0 ||
            !voteFor ||
            big(amount).lte(0) ||
            !!invalidTxFee ||
            !!invalidAmount
          }
          onClick={() => !!voteFor && submit(voteFor, amount)}
        >
          Submit
        </ActionButton>
      </Dialog>
    </Modal>
  );
}

const Component = styled(ComponentBase)`
  width: 720px;

  h1 {
    font-size: 27px;
    text-align: center;
    font-weight: 300;

    margin-bottom: 50px;
  }

  .vote {
    margin-top: 50px;

    list-style: none;
    padding: 0;

    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 120px;
    grid-gap: 40px;

    li {
      cursor: pointer;
      display: grid;
      place-content: center;
      color: #cccccc;
      border-radius: 5px;

      font-size: 28px;
      font-weight: 300;
      text-align: center;

      svg {
        font-size: 28px;
      }

      ${({ theme }) =>
        flat({
          color: theme.sectionBackgroundColor,
          intensity: theme.intensity,
          distance: 6,
        })};

      &[data-selected='true'] {
        &[data-vote='yes'] {
          color: #15cc93;
          border: 1px solid #15cc93;
          background-color: rgba(21, 204, 147, 0.05);
        }

        &[data-vote='no'] {
          color: #e95979;
          border: 1px solid #e95979;
          background-color: rgba(233, 89, 121, 0.06);
        }
      }
    }

    margin-bottom: 60px;
  }

  .amount {
    width: 100%;

    .MuiTypography-colorTextSecondary {
      color: currentColor;
    }
  }

  .wallet {
    display: flex;
    justify-content: space-between;

    font-size: 12px;
    color: ${({ theme }) => theme.dimTextColor};

    &[aria-invalid='true'] {
      color: ${({ theme }) => theme.colors.negative};
    }
  }

  .receipt {
    margin-bottom: 30px;
  }

  .submit {
    width: 100%;
    height: 60px;
    border-radius: 30px;
  }
`;
