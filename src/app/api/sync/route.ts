import { NextResponse } from 'next/server';
import { syncExpensesFromSheets, isSyncNeeded } from '@/lib/sync-sheets';

export async function POST() {
  try {
    const result = await syncExpensesFromSheets();

    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error syncing expenses:', error);
    return NextResponse.json(
      { error: 'Failed to sync expenses' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const needed = await isSyncNeeded();

    return NextResponse.json({
      syncNeeded: needed,
    });
  } catch (error) {
    console.error('Error checking sync status:', error);
    return NextResponse.json(
      { error: 'Failed to check sync status' },
      { status: 500 }
    );
  }
}
