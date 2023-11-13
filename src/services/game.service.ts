import { BetResolve } from "@/protocols/bet.types";
import { CustomError, ErrorType } from "@/protocols/error.types";
import { GameCreationDTO, GameFinishDTO } from "@/protocols/game.types";
import BetRepository from "@/repositories/bet.repository";
import GameRepository from "@/repositories/game.repository";
import { isWinningBet } from "@/utils/utils";
async function getAll() {
    const games = await GameRepository.getAll();
    return games;
}

async function create(game: GameCreationDTO) {
    const result = await GameRepository.create(game);
    if (!result) throw new CustomError(ErrorType.INTERNAL, "Game not created");
    return result;
}

async function getById(id: number) {
    const result = await GameRepository.getById(id);
    if (!result) throw new CustomError(ErrorType.NOT_FOUND, "Game not found");
    return result;
}

async function finish(id: number, game: GameFinishDTO) {
    const currentGame = await GameRepository.getById(id, true);
    if (!currentGame) throw new CustomError(ErrorType.NOT_FOUND, "Game not found");
    if (currentGame.isFinished) throw new CustomError(ErrorType.BAD_REQUEST, "Game is already finished");
    if (!game || !game.homeTeamScore || !game.awayTeamScore) {
        throw new CustomError(ErrorType.BAD_REQUEST, "Invalid game data provided");
    }
    const result = await GameRepository.finish(id, game);

    const winningBets = currentGame.bets.filter((bet) => {
        return isWinningBet(
            { awayTeamScore: game.awayTeamScore, homeTeamScore: game.homeTeamScore },
            { awayTeamScore: bet.awayTeamScore, homeTeamScore: bet.homeTeamScore }
        );
    });

    const totalWinningAmount = winningBets.reduce((total, bet) => total + bet.amountBet, 0);
    const betResolves: BetResolve[] = currentGame.bets.map((bet) => {
        const isWinner = isWinningBet(
            { awayTeamScore: game.awayTeamScore, homeTeamScore: game.homeTeamScore },
            { awayTeamScore: bet.awayTeamScore, homeTeamScore: bet.homeTeamScore }
        );
        const wonAmount = isWinner ? Math.floor((bet.amountBet / totalWinningAmount) * totalWinningAmount * 0.7) : 0;
        const betResolve: BetResolve = {
            betId: bet.id,
            amountWon: wonAmount,
            isWinner: isWinner
        };
        return betResolve;
    });

    await BetRepository.updateWinnersAndLosers(betResolves);
    return result;
}

const GameService = { getAll, create, getById, finish };

export default GameService;