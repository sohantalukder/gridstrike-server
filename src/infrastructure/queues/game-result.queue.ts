import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";

@Injectable()
@Processor("game-results")
export class GameResultProcessor extends WorkerHost {
  async process(job: Job): Promise<void> {
    void job;
    // Reserved for async background operations: leaderboards, achievements,
    // anti-cheat heuristics, push notifications.
    // For v1, jobs are acknowledged and validated in request pipeline.
    return;
  }
}
