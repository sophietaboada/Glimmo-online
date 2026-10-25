import { startSolo, stopSolo } from './solo.js';
import { joinRoom, leaveRoom, newRoomCode } from './group.js';
import { toast } from './cards.js';

const $ = (id) => document.getElementById(id);
const NAME_KEY = 'set-player-name';

function show(screen) {
  for (const id of ['menu', 'solo', 'group']) $(id).hidden = id !== screen;
}

function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

// Returns the entered name, or asks for one and returns null.
function playerName() {
  const name = $('player-name').value.trim();
  if (!name) {
    toast('Enter your name first');
    $('player-name').focus();
    return null;
  }
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch { /* storage unavailable — the name just isn't remembered */ }
  return name;
}

function enterRoom(code) {
  const name = playerName();
  if (!name) return;
  show('group');
  joinRoom(code, name);
}

function backToMenu() {
  stopSolo();
  leaveRoom();
  show('menu');
}

$('player-name').value = savedName();
$('play-solo').addEventListener('click', () => {
  show('solo');
  startSolo();
});
$('create-room').addEventListener('click', () => enterRoom(newRoomCode()));
$('join-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const code = $('room-code').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) {
    toast('Room codes are 4 letters');
    $('room-code').focus();
    return;
  }
  enterRoom(code);
});
$('solo-back').addEventListener('click', backToMenu);
$('group-back').addEventListener('click', backToMenu);
for (const id of ['menu-rules', 'rules-btn']) $(id).addEventListener('click', () => $('rules').showModal());

// An invite link (?room=ABCD) goes straight into the room when we already know the player's name.
const invited = new URLSearchParams(location.search).get('room')?.toUpperCase();
if (invited && /^[A-Z]{4}$/.test(invited)) {
  $('room-code').value = invited;
  if (savedName()) enterRoom(invited);
  else $('player-name').focus();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}
