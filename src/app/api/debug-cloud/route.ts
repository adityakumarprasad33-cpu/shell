import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const envVars = {
    // Standard platform indicators
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_REGION: process.env.VERCEL_REGION,
    VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID,
    AWS_LAMBDA_FUNCTION_NAME: process.env.AWS_LAMBDA_FUNCTION_NAME,
    AWS_REGION: process.env.AWS_REGION,
    LAMBDA_TASK_ROOT: process.env.LAMBDA_TASK_ROOT,
    LAMBDA_RUNTIME_DIR: process.env.LAMBDA_RUNTIME_DIR,
    AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
    AZURE_FUNCTIONS_ENVIRONMENT: process.env.AZURE_FUNCTIONS_ENVIRONMENT,
    NETLIFY: process.env.NETLIFY,
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT,
    RENDER: process.env.RENDER,
    FLY_APP_NAME: process.env.FLY_APP_NAME,
    
    // Manual overrides
    NEXT_PUBLIC_RUNIX_CLOUD: process.env.NEXT_PUBLIC_RUNIX_CLOUD,
    RUNIX_CLOUD: process.env.RUNIX_CLOUD,
    
    // Other relevant
    NODE_ENV: process.env.NODE_ENV,
    PATH: process.env.PATH?.substring(0, 200),
  };

  // Test binary availability
  const binaryTests: Record<string, boolean> = {};
  try {
    const { execSync } = require('child_process');
    const binaries = ['python3', 'python', 'node', 'java', 'javac', 'gcc', 'go', 'rustc'];
    for (const bin of binaries) {
      try {
        execSync(`which ${bin}`, { stdio: 'ignore', timeout: 1000 });
        binaryTests[bin] = true;
      } catch {
        binaryTests[bin] = false;
      }
    }
  } catch {
    binaryTests.error = true;
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    envVars,
    binaryTests,
    isCloudEnvironment: isCloudEnvironmentCheck(envVars, binaryTests),
  });
}

function isCloudEnvironmentCheck(envVars: Record<string, string | undefined>, binaryTests: Record<string, boolean>): boolean {
  // Explicit opt-in via env var
  if (envVars.NEXT_PUBLIC_RUNIX_CLOUD === '1' || envVars.RUNIX_CLOUD === '1') {
    return true;
  }

  // Standard platform env vars
  if (
    !!envVars.VERCEL ||
    !!envVars.AWS_LAMBDA_FUNCTION_NAME ||
    !!envVars.GOOGLE_CLOUD_PROJECT ||
    !!envVars.AZURE_FUNCTIONS_ENVIRONMENT ||
    !!envVars.NETLIFY ||
    !!envVars.RAILWAY_ENVIRONMENT ||
    !!envVars.RENDER ||
    !!envVars.FLY_APP_NAME
  ) {
    return true;
  }

  // Additional AWS Lambda indicators
  if (
    !!envVars.AWS_REGION ||
    !!envVars.LAMBDA_TASK_ROOT ||
    !!envVars.LAMBDA_RUNTIME_DIR ||
    !!envVars.AWS_EXECUTION_ENV
  ) {
    return true;
  }

  // Vercel-specific additional indicators
  if (
    !!envVars.VERCEL_ENV ||
    !!envVars.VERCEL_REGION ||
    !!envVars.VERCEL_DEPLOYMENT_ID
  ) {
    return true;
  }

  // Heuristic: if common system binaries are missing, we're likely in a restricted cloud environment
  const hasPython = binaryTests.python3 || binaryTests.python;
  const hasNode = binaryTests.node;
  return !hasPython || !hasNode;
}