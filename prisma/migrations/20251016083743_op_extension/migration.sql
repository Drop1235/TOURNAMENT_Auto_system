/*
  Warnings:

  - Added the required column `no` to the `Participant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `Tournament` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uid` to the `Tournament` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `Tournament` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Match" ADD COLUMN "nodeAId" TEXT;
ALTER TABLE "Match" ADD COLUMN "nodeBId" TEXT;
ALTER TABLE "Match" ADD COLUMN "opMemo" TEXT;

-- CreateTable
CREATE TABLE "DrawNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tournamentId" TEXT NOT NULL,
    "roundIndex" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "participantId" TEXT,
    "isBye" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "DrawNode_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DrawNode_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "no" INTEGER NOT NULL,
    "seed" INTEGER,
    "club" TEXT,
    "challongeParticipantId" INTEGER,
    "tournamentId" TEXT NOT NULL,
    CONSTRAINT "Participant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Participant" ("challongeParticipantId", "club", "id", "name", "seed", "tournamentId") SELECT "challongeParticipantId", "club", "id", "name", "seed", "tournamentId" FROM "Participant";
DROP TABLE "Participant";
ALTER TABLE "new_Participant" RENAME TO "Participant";
CREATE TABLE "new_Tournament" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    "uid" TEXT NOT NULL,
    "opLinked" BOOLEAN NOT NULL DEFAULT false,
    "opEndpointBase" TEXT,
    "challongeTournamentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Tournament" ("challongeTournamentId", "createdAt", "id", "name", "size") SELECT "challongeTournamentId", "createdAt", "id", "name", "size" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
CREATE UNIQUE INDEX "Tournament_uid_key" ON "Tournament"("uid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
