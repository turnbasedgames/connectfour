// TicTacToe Example
const Status = Object.freeze({
  PreGame: 'preGame',
  InGame: 'inGame',
  EndGame: 'endGame',
});

const Move = Object.freeze({
  JUMP: 'jump',
  REGULAR: 'regular',
});

function getPlrMark(player, plrs, king) {
  let piece;
  if (player.id === plrs[0].id) {
    piece = king ? '11' : '1';
    return piece;
  }

  piece = king ? '22' : '2';
  return piece;
}

/**
 * Generic board game types
 * @type Player: json object, in the format of
 * {
 *  id: string, unique player id
 *  username: string, the player's display name
 * }
 * @type BoardGame: json object, in the format of
 * {
 *  // creator read write fields
 *  state: json object, which represents any board game state
 *  joinable: boolean (default=true), whether or not the room can have new players added to it
 *  finished: boolean (default=false), when true there will be no new board game state changes
 *
 *  // creator read only
 *  players: [Player], array of player objects
 *  version: Number, an integer value that increases by 1 with each state change
 * }
 * @type BoardGameResult: json object, in the format of
 * {
 *  // fields that creator wants to overwrite
 *  state?: json object, which represents any board game state
 *  joinable?: boolean, whether or not the room can have new players added to it
 *  finished?: boolean, when true there will be no new board game state changes
 * }
 */

/**
 * onRoomStart
 * @returns {BoardGameResult}
 */
function onRoomStart() {
  return {
    state: {
      status: Status.PreGame,
      board: [
        [null, '2', null, '2', null, '2', null, '2'],
        ['2', null, '2', null, '2', null, '2', null],
        [null, '2', null, '2', null, '2', null, '2'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['1', null, '1', null, '1', null, '1', null],
        [null, '1', null, '1', null, '1', null, '1'],
        ['1', null, '1', null, '1', null, '1', null],
      ],
      moveDetails: {},
      plrOneCounter: 12,
      plrTwoCounter: 12,
      winner: null, // null means tie if game is finished, otherwise set to the plr that won
    },
  };
}

/**
 * onPlayerJoin
 * @param {Player} player, represents the player that is attempting to join this game
 * @param {BoardGame} currentGame
 * @returns {BoardGameResult}
 */
function onPlayerJoin(player, boardGame) {
  const { players, state } = boardGame;

  // VALIDATIONS
  // check if game has started
  if (state.status !== Status.PreGame) {
    throw new Error("game has already started, can't join the game!");
  }

  // TRANSFORMATIONS
  // determine if we should start the game
  if (players.length === 2) {
    // start game
    state.status = Status.InGame;
    state.plrToMoveIndex = 0;
    return {
      state,
      joinable: false,
    };
  }
  return {
    state,
    joinable: true,
  };
}

/**
 * onPlayerMove
 * @param {Player} player, the player that is attempting to make a move
 * @param {*} move json object, controlled the creator that represents the player's move
 * @param {BoardGame} currentGame
 * @returns {BoardGameResult}
 */
function onPlayerMove(player, move, boardGame) {
  const { state, players } = boardGame;
  const { board, plrToMoveIndex, plrOneCounter, plrTwoCounter } = state;

  // VALIDATIONS
  // boardgame must be in the game
  if (state.status !== Status.InGame) {
    throw new Error("game is not in progress, can't make move!");
  }

  if (players[plrToMoveIndex].id !== player.id) {
    throw new Error(`It is not this player's turn: ${player.username}`);
  }

  const { currentLoc, nextLoc, capture, switchPlayer } = move;

  if (switchPlayer === true) {
    state.moveDetails = {};
    state.plrToMoveIndex = plrToMoveIndex === 0 ? 1 : 0;
    return { state };
  }

  const isKing = (board[currentLoc.x][currentLoc.y] === '11' || board[currentLoc.x][currentLoc.y] === '22');
  const shouldMakeKing = ((state.plrToMoveIndex === 0 && nextLoc.x === 0) || (state.plrToMoveIndex === 1 && nextLoc.x === 7)) ? true : false;

  // backend should have validation logic for what the frontend is doing
  // to prevent directly hitting the API and corrupting the game
  let moveInfo = {
    moveType: Move.REGULAR,
  };

  board[currentLoc.x][currentLoc.y] = null;
  if (capture) {
    board[capture.x][capture.y] = null;
    moveInfo.moveType = Move.JUMP;
    if (state.plrToMoveIndex === 0) {
      state.plrTwoCounter = plrTwoCounter - 1;
    } else {
      state.plrOneCounter = plrOneCounter - 1;
    }
  }

  const king = isKing || shouldMakeKing;

  const plrMark = getPlrMark(player, players, king);

  // check if player should be king or not
  board[nextLoc.x][nextLoc.y] = plrMark;
  moveInfo.pieceLocation = { x: nextLoc.x, y: nextLoc.y };

  state.moveDetails = moveInfo;

  if (state.plrOneCounter === 0) {
    state.status = Status.EndGame;
    state.winner = plrs[1];
    return { state, finished: true };
  }

  if (state.plrTwoCounter === 0) {
    state.status = Status.EndGame;
    state.winner = plrs[0];
    return { state, finished: true };
  }
  // Check if game is over

  return { state };
}

/**
 * onPlayerQuit
 * @param {Player} player, the player that is attempting to quit the game
 * @param {BoardGame} currentGame
 * @returns {BoardGameResult}
 */
function onPlayerQuit(player, boardGame) {
  const { state, players } = boardGame;
  state.status = Status.EndGame;
  if (players.length === 1) {
    const [winner] = players;
    state.winner = winner;
    return { state, joinable: false, finished: true };
  }
  return { joinable: false, finished: true };
}

module.exports = {
  onRoomStart,
  onPlayerJoin,
  onPlayerMove,
  onPlayerQuit,
};
