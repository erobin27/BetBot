import {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ModalBuilder,
  SelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import {
  listToSelectOptions,
  embedFighterChoice,
  embedFights,
} from '@displayFormatting/index';

export let wagerModal = () => {
  // Create the modal
  const modal = new ModalBuilder().setCustomId('myModal').setTitle('My Modal');

// Create the text input components
const wagerInput = new TextInputBuilder()
  .setCustomId('wagerInput')
  .setLabel("How much would you like to wager?")
  .setStyle(TextInputStyle.Short);


// An action row only holds one text input,
// so you need one action row per text input.
const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(wagerInput);

// Add inputs to the modal
  modal.addComponents(firstActionRow);
  return modal;
}
  
export const matchSelectMenu = (ufcApiResponse) => {
  const matchupList: string[] = Object.keys(ufcApiResponse['fights']);
  const embedList: EmbedBuilder[] = embedFights(ufcApiResponse);
  let matchSelector = new ActionRowBuilder().addComponents(
    new SelectMenuBuilder()
      .setCustomId('select')
      .setPlaceholder('Nothing selected')
      .addOptions(listToSelectOptions(matchupList)),
  );

  return {
    content: '',
    embeds: embedList,
    components: [matchSelector],
    ephemeral: true,
  };

}

export const choiceMessage = (ufcApiResponse, selectedMatch) => {
  const { Red, Blue } = ufcApiResponse.fights[selectedMatch];
  const embed = embedFighterChoice(ufcApiResponse, selectedMatch);
  let fighterButtons = new ActionRowBuilder()
      .addComponents(
          new ButtonBuilder().setCustomId('Red').setStyle(4).setLabel(Red.Name),
          new ButtonBuilder().setCustomId('Blue').setStyle(1).setLabel(Blue.Name),
          new ButtonBuilder().setCustomId('Cancel').setStyle(2).setLabel('Cancel').setEmoji('🚫'),
  );
  return {
    content: '',
    embeds: [embed],
    components: [fighterButtons],
    ephemeral: true,
    fetchReply: true,
  }
};

