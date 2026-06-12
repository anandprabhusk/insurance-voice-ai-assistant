import { chromium } from 'playwright';

// Strict CSS Selector Map for local dummy HTML
const QIC_DOM_MAP = {
  TARGET_URL: 'http://localhost:5173/abc_insurance_dummy.html',
  INPUTS: {
    PHONE: '#phone',
    MAKE: 'input[placeholder="Make"]',
    MODEL: 'input[placeholder="Model"]',
    YEAR: 'input[placeholder="Year"]',
    REG_YEAR: 'input[placeholder="Registration Year"]',
    QID: 'input[placeholder="QID Number"]'
  },
  ACTIONS: {
    PROCEED_1: 'button:has-text("Proceed")',
    COMPREHENSIVE: 'button:has-text("Comprehensive")',
    THIRD_PARTY: 'button:has-text("Third-Party")',
    NEXT_3: 'button:has-text("Next")',
    GET_QUOTE: 'button:has-text("Get Quote")'
  }
};

// Note: In a true production app, `browser` and `page` would be instantiated 
// globally on the server so the session stays open between voice commands.
let activeBrowser = null;
let activePage = null;

export async function executeAutomationRoute(aiCommand, updateScreenStep) {
  console.log(`[CONTROLLER] Action received: ${aiCommand.action}`);

  // Initialize browser session if it doesn't exist
  if (!activeBrowser) {
    activeBrowser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await activeBrowser.newContext();
    activePage = await context.newPage();
    await activePage.goto(QIC_DOM_MAP.TARGET_URL);
  }

  try {
    // STEP 1: PHONE NUMBER
    if (aiCommand.action === 'SUBMIT_PHONE' && aiCommand.phoneNumber) {
      await activePage.fill(QIC_DOM_MAP.INPUTS.PHONE, aiCommand.phoneNumber);
      await activePage.click(QIC_DOM_MAP.ACTIONS.PROCEED_1);
      updateScreenStep('PLAN_SELECTION', aiCommand.message);
    }

    // STEP 2: COVERAGE TYPE
    if (aiCommand.action === 'SELECT_PRODUCT' && aiCommand.productType) {
      if (aiCommand.productType.toLowerCase().includes('comprehensive')) {
        await activePage.click(QIC_DOM_MAP.ACTIONS.COMPREHENSIVE);
      } else {
        await activePage.click(QIC_DOM_MAP.ACTIONS.THIRD_PARTY);
      }
      updateScreenStep('CAR_SPECS', aiCommand.message);
    }

    // STEP 3: CAR DETAILS
    if (aiCommand.action === 'SUBMIT_CAR_DETAILS') {
      if (aiCommand.carBrand) await activePage.fill(QIC_DOM_MAP.INPUTS.MAKE, aiCommand.carBrand);
      if (aiCommand.carModel) await activePage.fill(QIC_DOM_MAP.INPUTS.MODEL, aiCommand.carModel);
      if (aiCommand.carYear) await activePage.fill(QIC_DOM_MAP.INPUTS.YEAR, aiCommand.carYear.toString());
      
      await activePage.click(QIC_DOM_MAP.ACTIONS.NEXT_3);
      updateScreenStep('REGISTRATION', aiCommand.message);
    }

    // STEP 4: REGISTRATION & QID
    if (aiCommand.action === 'GET_QUOTE') {
      if (aiCommand.regYear) await activePage.fill(QIC_DOM_MAP.INPUTS.REG_YEAR, aiCommand.regYear.toString());
      if (aiCommand.qid) await activePage.fill(QIC_DOM_MAP.INPUTS.QID, aiCommand.qid.toString());
      
      // Handle the Javascript Alert from the dummy HTML
      activePage.once('dialog', dialog => dialog.accept());
      await activePage.click(QIC_DOM_MAP.ACTIONS.GET_QUOTE);
      
      updateScreenStep('COMPLETE', aiCommand.message);
    }

    return { success: true };

  } catch (error) {
    console.error("❌ [CONTROLLER FAULT]", error);
    return { success: false, error: error.message };
  }
}