import React, { useState, useEffect } from 'react';
import {
  ThemeProvider, Typography, Stack, Box, List, ListItem, ListItemText, Paper, Snackbar, Alert, Fade,
} from '@mui/material';

import client, { events } from '@urturn/client';
import theme from './theme';

const typeOfMoves = Object.freeze({
  JUMP: 'jump',
  REGULAR: 'regular',
});

// prevent rerendering tictactoe row and entries that are the same value
const getRowKey = (row, rowNum) => `${rowNum}-${row.join('-')}`;
// const getColKey = (val, colNum) => `${colNum}-${val}`;

const getStackKey = (rowNum, colNum, val) => {
  const gridVal = val || '-1';
  return `${rowNum}-${colNum}-${gridVal}`;
};

const getStatusMsg = ({
  status, winner, finished, plrToMove,
}) => {
  if (finished) {
    if (winner) {
      return `${winner.username} won the game!`;
    }
    return "It's a tie!";
  } if (status === 'preGame') {
    return 'Waiting on another player...';
  } if (status === 'inGame') {
    return `Waiting on player ${plrToMove.username} to make their move...`;
  }
  return 'Error: You should never see this. Contact developers!';
};

function App() {
  const [boardGame, setBoardGame] = useState(client.getBoardGame() || {});

  useEffect(() => {
    const onStateChanged = (newBoardGame) => {
      setBoardGame(newBoardGame);
    };
    events.on('stateChanged', onStateChanged);
    return () => {
      events.off('stateChanged', onStateChanged);
    };
  }, []);

  const [recentErrorMsg, setRecentErrorMsg] = useState(null);
  // MoveInfo should include the possible moves to make which is
  // an array and the row, col of a selected piece
  const [moveInfo, setMoveInfo] = useState({});

  const {
    state: {
      board,
      status,
      winner,
      plrToMoveIndex,
      moveDetails,
    } = {
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
    },
  } = boardGame;

  const { players = [], finished } = boardGame;
  const generalStatus = getStatusMsg({
    status, winner, finished, plrToMove: status === 'inGame' ? players[plrToMoveIndex] : null,
  });

  function clearState() {
    setMoveInfo({});
  }

  async function switchPlayer() {
    // switch the player with makeMove
    const move = {
      switchPlayer: true,
    };

    const { error } = await client.makeMove(move);

    // clear move info state when swtiching player
    clearState();

    return error;
  }

  function getJumpCondition(possPieceRow, possPieceCol) {
    const jumpCondition = plrToMoveIndex === 0
      ? (board[possPieceRow][possPieceCol] === '2' || board[possPieceRow][possPieceCol] === '22')
      : (board[possPieceRow][possPieceCol] === '1' || board[possPieceRow][possPieceCol] === '11');

    return jumpCondition;
  }

  function determinePossibleJumpMovesHelper(rowNum, colNum, upward) {
    const moves = [];

    const rowModifierJump = upward === true ? -2 : 2;
    const rowModifierPiece = upward === true ? -1 : 1;

    const possJumpRow = rowNum + rowModifierJump;
    const possJumpCol1 = colNum - 2;
    const possJumpCol2 = colNum + 2;

    const condition = rowModifierJump === -2 ? (possJumpRow >= 0) : (possJumpRow <= 7);

    if (condition) {
      if (possJumpCol1 >= 0 && board[possJumpRow][possJumpCol1] === null) {
        const possPieceRow = rowNum + rowModifierPiece;
        const possPieceCol = colNum - 1;

        const jumpCondition = getJumpCondition(possPieceRow, possPieceCol);

        if (jumpCondition) {
          const capture = {
            x: possPieceRow,
            y: possPieceCol,
          };
          moves.push({ x: possJumpRow, y: possJumpCol1, capture });
        }
      }

      if (possJumpCol2 <= 7 && board[possJumpRow][possJumpCol2] === null) {
        const possPieceRow = rowNum + rowModifierPiece;
        const possPieceCol = colNum + 1;

        const jumpCondition = getJumpCondition(possPieceRow, possPieceCol);

        if (jumpCondition) {
          const capture = {
            x: possPieceRow,
            y: possPieceCol,
          };
          moves.push({ x: possJumpRow, y: possJumpCol2, capture });
        }
      }
    }

    return moves;
  }

  function determinePossibleJumpMoves(rowNum, colNum) {
    let possLoc = board[rowNum][colNum];
    if (typeof possLoc === 'number') {
      possLoc = `${possLoc}`;
    }

    let possibleMoves = [];
    if (plrToMoveIndex === 0) {
      const jumpMovesUpward = determinePossibleJumpMovesHelper(rowNum, colNum, true);
      if (possLoc === '11') {
        const jumpMovesDownward = determinePossibleJumpMovesHelper(rowNum, colNum, false);
        possibleMoves = possibleMoves.concat(jumpMovesDownward);
      }

      possibleMoves = possibleMoves.concat(jumpMovesUpward);
    }

    if (plrToMoveIndex === 1) {
      const jumpMovesDownward = determinePossibleJumpMovesHelper(rowNum, colNum, false);
      if (possLoc === '22') {
        const jumpMovesUpward = determinePossibleJumpMovesHelper(rowNum, colNum, true);
        possibleMoves = possibleMoves.concat(jumpMovesUpward);
      }

      possibleMoves = possibleMoves.concat(jumpMovesDownward);
    }

    return possibleMoves;
  }

  async function continuousJumpHelper(rowNum, colNum) {
    const moves = determinePossibleJumpMoves(rowNum, colNum);

    if (moves.length <= 0) {
      const err = await switchPlayer();
      if (err) {
        setRecentErrorMsg(err.message);
      }
    } else {
      setMoveInfo({
        possibleMoves: moves,
        selectedPieceInfo: {
          x: rowNum,
          y: colNum,
        },
      });
    }
  }

  function determinePossibleRegularMovesHelper(rowNum, colNum, upward) {
    const possMoves = [];

    const rowModifier = upward === true ? -1 : 1;

    const possMoveRow = rowNum + rowModifier;
    const possMoveCol1 = colNum - 1;
    const possMoveCol2 = colNum + 1;

    const condition = rowModifier === -1 ? (possMoveRow >= 0) : (possMoveRow <= 7);

    if (condition) {
      if (possMoveCol1 >= 0 && board[possMoveRow][possMoveCol1] === null) {
        possMoves.push({
          x: possMoveRow,
          y: possMoveCol1,
        });
      }

      if (possMoveCol2 <= 7 && board[possMoveRow][possMoveCol2] === null) {
        possMoves.push({
          x: possMoveRow,
          y: possMoveCol2,
        });
      }
    }

    return possMoves;
  }

  function determinePossibleRegularMoves(rowNum, colNum) {
    let possibleMoves = [];
    let possLoc = board[rowNum][colNum];
    if (typeof possLoc === 'number') {
      possLoc = `${possLoc}`;
    }

    if (plrToMoveIndex === 0) {
      const upwardMoves = determinePossibleRegularMovesHelper(rowNum, colNum, true);
      if (possLoc === '11') {
        const downwardMoves = determinePossibleRegularMovesHelper(rowNum, colNum, false);
        possibleMoves = possibleMoves.concat(downwardMoves);
      }

      possibleMoves = possibleMoves.concat(upwardMoves);
    }

    if (plrToMoveIndex === 1) {
      const downwardMoves = determinePossibleRegularMovesHelper(rowNum, colNum, false);
      if (possLoc === '22') {
        const upwardMoves = determinePossibleRegularMovesHelper(rowNum, colNum, true);
        possibleMoves = possibleMoves.concat(upwardMoves);
      }

      possibleMoves = possibleMoves.concat(downwardMoves);
    }

    return possibleMoves;
  }

  // component method to turn possible moves yellow in border color
  function determinePossibleMoves(rowNum, colNum) {
    // if piece was selected determine the moves else return
    // from this function without setting anything
    let possLoc = board[rowNum][colNum];
    if (typeof possLoc === 'number') {
      possLoc = `${possLoc}`;
    }

    if (plrToMoveIndex === 0 && (possLoc !== '1'
      && possLoc !== '11')) {
      setRecentErrorMsg('Illegal move/location');
      return;
    } if (plrToMoveIndex === 1 && (possLoc !== '2'
      && possLoc !== '22')) {
      setRecentErrorMsg('Illegal move/location');
      return;
    }

    // check for regular move?
    // for bottom half pieces it has to be rowNum - 1, colNum + 1
    // or rowNum - 1, colNum - 1

    // for top half pieces it has to be rowNum + 1, colNum + 1
    // or rowNum + 1, colNum - 1
    // check for bounds for all of these moves. If the piece is a king
    // any of these possible moves apply

    let possibleMoves = [];
    // check for which player it is

    // check for jump should be recursive until no
    // more jumps are possible
    // else keep piece selected
    // for bottom half pieces it has to be rowNum - 2, colNum + 2
    // or rowNum - 2, colNum - 2.
    // Those indices have to be empty and opponent piece
    // has to be in rowNum - 1, rowNum + 1
    // and rowNum - 1, colNum - 1 respectively

    // for top half pieces it has to be rowNum + 2 and colNum + 2
    // or rowNum + 2, colNum - 2.
    // Those indices have to be empty and opponent piece
    // has to be in rowNum + 1, colNum + 1
    // and rowNum + 1, colNum - 1 respectively
    const jumpMoves = determinePossibleJumpMoves(rowNum, colNum);
    possibleMoves = possibleMoves.concat(jumpMoves);

    const regularMoves = determinePossibleRegularMoves(rowNum, colNum);
    possibleMoves = possibleMoves.concat(regularMoves);

    setMoveInfo({
      possibleMoves,
      selectedPieceInfo: {
        x: rowNum,
        y: colNum,
      },
    });
  }

  // This should check if the move the client is trying to make is possible. Any impossible move
  // should basically reset back to this function and be a no-op
  async function makePossibleMove(currentLoc, nextLoc, capture) {
    const move = {
      currentLoc,
      nextLoc,
      capture,
    };

    const { error } = await client.makeMove(move);

    const typeOfMove = capture ? typeOfMoves.JUMP : typeOfMoves.REGULAR;

    return { typeOfMove, error };
  }

  return (
    <ThemeProvider theme={theme}>
      <Stack spacing={1} sx={{ justifyContent: 'center' }}>
        <Typography variant="h3" textAlign="center" color="text.primary">Checkers</Typography>
        <Typography textAlign="center" color="text.primary">{generalStatus}</Typography>
        <Stack margin={2} spacing={1} direction="row" justifyContent="center">
          <Box>
            {board.map((row, rowNum) => (
              <Stack key={getRowKey(row, rowNum)} direction="row">
                {row.map((val, colNum) => {
                  let borderColor = 'text.primary';
                  let border = 3;
                  if (moveInfo.possibleMoves) {
                    moveInfo.possibleMoves.forEach((move) => {
                      if (move.x === rowNum && move.y === colNum) {
                        border = 3;
                        borderColor = 'yellow';
                      }
                    });
                  }
                  const thisStack = (
                    <Stack
                      key={getStackKey(rowNum, colNum, val)}
                      direction="row"
                      justifyContent="center"
                      alignItems="center"
                      sx={{
                        border,
                        borderColor,
                        height: '70px',
                        width: '70px',
                      }}
                      onClick={async (event) => {
                        event.preventDefault();

                        // if there are no possible moves in the array, then the user
                        // can actively make a move
                        if (moveInfo.possibleMoves && moveInfo.possibleMoves.length > 0) {
                          // determine if this position exists in the possibleMoves array
                          // else determine the possible moves again
                          const moveExists = (elem) => (elem.x === rowNum && elem.y === colNum);
                          const possibleMove = moveInfo.possibleMoves
                          && moveInfo.possibleMoves.find(moveExists);

                          if (possibleMove) {
                            const { selectedPieceInfo } = moveInfo;
                            const currentLoc = { x: selectedPieceInfo.x, y: selectedPieceInfo.y };
                            const nextLoc = { x: possibleMove.x, y: possibleMove.y };
                            const { capture } = possibleMove;
                            const {
                              typeOfMove,
                              error,
                            } = await makePossibleMove(currentLoc, nextLoc, capture);
                            // if the type of move was a jump, determine more possible jumps
                            // and if there are more player can only jump
                            // if not move player index to other player
                            if (error) {
                              setRecentErrorMsg(error.message);
                            }
                            if (typeOfMove === typeOfMoves.REGULAR) {
                              const err = await switchPlayer();
                              if (err) {
                                setRecentErrorMsg(err.message);
                              }
                            } else {
                              await continuousJumpHelper(nextLoc.x, nextLoc.y);
                            }
                          } else {
                            determinePossibleMoves(rowNum, colNum);
                          }
                        } else if (moveDetails.moveType === typeOfMoves.JUMP) {
                          const { pieceLocation } = moveDetails;
                          await continuousJumpHelper(pieceLocation.x, pieceLocation.y);
                        } else {
                          determinePossibleMoves(rowNum, colNum);
                        }
                        // on click we have to determine the possible moves
                        // for the user making the move
                        // and then move the piece when the user decides to do so
                        // if piece is 0 < x <=7 and 0 < y <= 7, and nothing is blocking
                        // then user can move to
                        // to board[x-1][y-1] or board[x+1][y+1]
                      }}
                    >
                      <Typography color="text.primary" fontSize="60px">
                        {val}
                      </Typography>
                    </Stack>
                  );
                  return thisStack;
                })}
              </Stack>
            ))}
          </Box>
          <Paper>
            <Stack padding={1} sx={{ minWidth: '100px' }}>
              <Typography disableGutter color="text.primary">Players</Typography>
              <List dense disablePadding padding={0}>
                {players.map((player, ind) => (
                  <ListItem dense disablePadding key={player.id}>
                    <ListItemText primary={`${ind + 1}: ${player.username}`} />
                  </ListItem>
                ))}
              </List>
            </Stack>
          </Paper>
        </Stack>
      </Stack>
      <Snackbar
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={recentErrorMsg !== null}
        onClose={() => { setRecentErrorMsg(null); }}
        TransationComponent={Fade}
      >
        <Alert severity="error" sx={{ width: '100%' }}>
          {recentErrorMsg}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}

export default App;
