import type {View} from './work.ts';

export type CardStatus = 'active' | 'completed' | 'expired';
export type Card = {
  id: string; owner: string; chat_id: number; message_id: number | null;
  revision: number; rendered_revision: number; status: CardStatus;
  view_json: string; expires: number; lease_token: string | null; lease_until: number | null;
};
export type CardAction = {token: string; card_id: string; owner: string; revision: number; action: string; consumed: number};
export type UiReply =
  | {mode: 'send'; view: View}
  | {mode: 'edit'; cardId: string; expectedRevision: number; view: View; status: CardStatus}
  | {mode: 'notice'; text: string};

export function actionAvailable(card: Card, action: CardAction, owner: string, chat: number, message: number, now: number) {
  return card.owner === owner && action.owner === owner && card.chat_id === chat && card.message_id === message
    && card.id === action.card_id && card.revision === action.revision && card.rendered_revision === card.revision
    && !action.consumed && card.status === 'active' && card.expires > now;
}
