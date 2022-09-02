import {
  ChatInputCommandInteraction,
  ComponentType,
  MessagePayload,
} from 'discord.js';
import {
  getButtonInteraction,
  getModalResponse,
  getSelectOptionInteraction,
} from '@displayFormatting/index';
import { choiceMessage, matchSelectMenu, wagerModal } from './betMenu';
import { logError } from '@utils/log';
import { CreateUserDto } from 'src/dtos/createUser.dto';
import {
  getEventByUrl, getUpcomingFights,
  createMatch, getUserWalletId, getWallet, placeBet
} from '@apis';
import { match } from 'assert';
import { PlaceBetDto } from 'src/dtos/placeBet.dto';
import { Wager } from '@classes';

export async function startBetSaga(interaction) {
  //------------------------------------------------
  //              Wager Modal
  //------------------------------------------------
  const createUserDto = new CreateUserDto(interaction);
  const walletRes = await getUserWalletId(createUserDto);
  if (!walletRes) {
    interaction.reply('Error finding your wallet.');
  }
  const walletId = walletRes.walletId;
  const usersWallet = await getWallet(walletId);

  //------------------------------------------------
  //              Wager Modal
  //------------------------------------------------
  const modal = wagerModal();
  await interaction.showModal(modal);
  const modalResponseInteraction: any = await getModalResponse(interaction);
  if (!modalResponseInteraction) {
    interaction.followUp({ content: 'Modal timed out!', ephemeral: true });
    return;
  }
  const wager = modalResponseInteraction.fields.getTextInputValue('wagerInput');
  const wagerClass: Wager = new Wager(wager, usersWallet.amount);
  if (!(await wagerClass.validate())) {
    modalResponseInteraction.reply(wagerClass.generateErrorMessage());
    return;
  }

  //------------------------------------------------
  //              Temp Message - UFC Api
  //------------------------------------------------
  let tempMsg = await modalResponseInteraction.reply({
    content: 'Retrieving data please wait...',
    ephemeral: true,
  });
  const response = await getUpcomingFights();
  if (!response) {
    modalResponseInteraction.editReply(
      'Error retrieving data, try again. This can be caused by the API being asleep.',
    );
    logError('NO API RESPONSE, is server running?');
    return;
  }

  //------------------------------------------------
  //              Select Match Menu
  //------------------------------------------------
  const matchSelectionMsg = await modalResponseInteraction.editReply(
    matchSelectMenu(response),
  );

  // Get the match selection response
  const selectedInteraction = await getSelectOptionInteraction(
    matchSelectionMsg,
    modalResponseInteraction.user.id,
  );
  if (!selectedInteraction || selectedInteraction.values[0] === 'Cancel') {
    //TODO: Let user know they have cancelled
    return;
  }

  const selectedMatch = selectedInteraction.values[0];

  //------------------------------------------------
  //              Choose Fighter Buttons
  //------------------------------------------------
  const choiceMsg = await selectedInteraction.update(
    choiceMessage(response, selectedMatch),
  );
  const buttonInteraction = await getButtonInteraction(
    choiceMsg,
    modalResponseInteraction.user.id,
  );

  if (!buttonInteraction || buttonInteraction.customId === 'Cancel') {
    //TODO: Let user know they have cancelled
    return;
  }
  const selectedCorner = buttonInteraction.customId;

  //------------------------------------------------
  //              Validate Wager, Fight, etc.
  //------------------------------------------------
  let placingBetMessage = await modalResponseInteraction.editReply({
    content: 'Validating and Placing Bet...',
    embeds: [],
    components: [],
    ephemeral: true,
  });
  const validateUfcBetApiResponse = await getEventByUrl(response.url);
  if (!validateUfcBetApiResponse) {
    modalResponseInteraction.editReply(
      'Error validating UFC Event, try again.',
    );
    logError('NO VALIDATION API RESPONSE, is server running?');
    return;
  }

  if (validateUfcBetApiResponse.fights[selectedMatch].Details.isLive) {
    modalResponseInteraction.editReply(
      'The match is already live.',
    );
  }

  if (validateUfcBetApiResponse.fights[selectedMatch].Details.Round) {
    modalResponseInteraction.editReply(
      'The match is already over.',
    );
  }

  
  const matchRes = await createMatch({eventTitle: validateUfcBetApiResponse.eventTitle, matchTitle: selectedMatch, link: validateUfcBetApiResponse.url});
  if (!matchRes) {
    modalResponseInteraction.editReply(
      'The match failed to post, report this error.',
    );
    return;
  }
  const { matchId } = matchRes;

  wagerClass.calculateWagerDetails(validateUfcBetApiResponse.fights[selectedMatch][selectedCorner].Odds);

  //Place bet
  const placeBetDto: PlaceBetDto = {
    matchId,
    userId: interaction.user.id,
    walletId,
    selectedCorner,
    wagerOdds: wagerClass.wagerOdds,
    wagerAmount: wagerClass.amount,
    amountToWin: wagerClass.amountToWin,
    amountToPayout: wagerClass.amountToPayout,
  }
  const betRes = await placeBet(placeBetDto);
  if (!betRes) {
    modalResponseInteraction.editReply(
      'The bet failed to place. This can be cause by outdated wallet amounts. Try again.',
    );
    return;
  }

  //------------------------------------------------
  //              Store In Database
  //------------------------------------------------

  //------------------------------------------------
  //              Respond to User
  //------------------------------------------------
  modalResponseInteraction.editReply({
    content: `You have selected ${buttonInteraction.customId}`,
    embeds: [],
    components: [],
  });
}
