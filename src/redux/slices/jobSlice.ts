import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Job {
  _id: string;
  jobCount: number;
  carName: string;
  customerName: string;
  status: string;
  [key: string]: unknown;
}

interface JobState {
  jobs: Job[];
}

const initialState: JobState = {
  jobs: [],
};

export const jobSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setJobs(state, action: PayloadAction<Job[]>) {
      state.jobs = action.payload;
    },
    addJob(state, action: PayloadAction<Job>) {
      state.jobs.unshift(action.payload);
    },
    updateJob(state, action: PayloadAction<Job>) {
      const index = state.jobs.findIndex((j) => j._id === action.payload._id);
      if (index !== -1) {
        state.jobs[index] = action.payload;
      }
    },
  },
});

export const { setJobs, addJob, updateJob } = jobSlice.actions;
export default jobSlice.reducer;
