const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")
const { BaseContract } = require("ethers")
const { textSpanContainsTextSpan } = require("typescript")
developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Test", function () {
          let lottery, lotteryEntranceFee, deployer
          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer

              lottery = await ethers.getContract("Lottery", deployer)
              console.log(lottery)

              lotteryEntranceFee = await lottery.getEntranceFee()
          })
          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async () => {
                  const startingTimeStamp = await lottery.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()

                  //   console.log(accounts)

                  //   await lottery.enterLottery({
                  //       value: lotteryEntranceFee,
                  //   })
                  //   console.log("done so far")
                  await new Promise(async (res, rej) => {
                      //   let startingBalance
                      let winnerStartingBalance, gasUsed, gasPrice
                      lottery.once("WinnerPicked", async function () {
                          console.log("Winner Picked!")
                          try {
                              const recentWinner =
                                  await lottery.getRecentWinner()
                              const raffleState =
                                  await lottery.getLotteryState()
                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(accounts[0])
                              const endingTimeStamp =
                                  await lottery.getLatestTimeStamp()
                              await expect(lottery.getPlayer(0)).to.be.reverted
                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address,
                              )
                              assert.equal(raffleState, 0)
                              assert.equal(
                                  BigInt(winnerEndingBalance).toString(),
                                  (
                                      BigInt(winnerStartingBalance) +
                                      BigInt(lotteryEntranceFee)
                                  ).toString(),
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              res()
                          } catch (err) {
                              console.log(err)
                              rej(err)
                          }
                      })
                      try {
                          console.log("Entering")

                          const tx = await lottery.enterLottery({
                              value: lotteryEntranceFee,
                          })
                          let rec = await tx.wait(1)
                          console.log(rec)
                          //   let { gasPrice, gasUsed } = rec

                          //   console.log(tx)
                          //   tx.wait(1)
                          winnerStartingBalance =
                              await ethers.provider.getBalance(deployer)
                          console.log(
                              "startingBalance gained",
                              winnerStartingBalance,
                          )
                      } catch (err) {
                          console.log(err)
                      }
                  })
              })
          })
      })
