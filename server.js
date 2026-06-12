import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let globalPage = null;

async function getActivePage() {
    if (globalPage && !globalPage.isClosed()) return globalPage;
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const context = await browser.newContext();
    globalPage = await context.newPage();
    await globalPage.goto('http://localhost:5173/abc_insurance_dummy.html'); 
    return globalPage;
}

async function detectCurrentStage(page) {
    if (await page.locator('#step-1').evaluate(el => el.classList.contains('active'))) return 'GATEKEEPER';
    if (await page.locator('#step-2').evaluate(el => el.classList.contains('active'))) return 'PLAN_SELECTION';
    if (await page.locator('#step-3').evaluate(el => el.classList.contains('active'))) return 'CAR_SPECS';
    if (await page.locator('#step-4').evaluate(el => el.classList.contains('active'))) return 'REGISTRATION';
    if (await page.locator('#step-5').evaluate(el => el.classList.contains('active'))) return 'COMPLETE';
    return 'UNKNOWN';
}

app.post('/api/automate', async (req, res) => {
    const { command } = req.body;
    const page = await getActivePage();

    try {
        console.log("🤖 Received AI Command:", command);
        const currentStage = await detectCurrentStage(page);

        // STEP 1: Phone
        if (command.action === 'SUBMIT_PHONE' && currentStage === 'GATEKEEPER') {
            await page.fill('#phone', command.phoneNumber);
            await page.evaluate(() => goToStep(2));
            res.json({ stage: { screen: 'PLAN_SELECTION', message: command.message || "Phone set. Please select Comprehensive or Third-Party plan." } });
            return;
        } 
        // STEP 2: Coverage Plan
        else if (command.action === 'SELECT_PRODUCT' && currentStage === 'PLAN_SELECTION') {
            if (command.productType.toLowerCase().includes('comprehensive')) {
                await page.click('button:has-text("Comprehensive")');
            } else {
                await page.click('button:has-text("Third-Party")');
            }
            res.json({ stage: { screen: 'CAR_SPECS', message: command.message || "Plan selected. What is your car make, model, and year?" } });
            return;
        }
        // STEP 3: Car Details
        else if (command.action === 'SUBMIT_CAR_DETAILS' && currentStage === 'CAR_SPECS') {
            if (command.carBrand) await page.fill('#make', command.carBrand);
            if (command.carModel) await page.fill('#model', command.carModel);
            if (command.carYear) await page.fill('#year', command.carYear.toString());

            await page.evaluate(() => processStep3()); 
            res.json({ stage: { screen: 'REGISTRATION', message: command.message || "Car details saved. Please provide your Registration Year and QID number." } });
            return;
        }
        // STEP 4: Registration & QID
        else if (command.action === 'GET_QUOTE' && currentStage === 'REGISTRATION') {
            if (command.regYear) await page.fill('#reg-year', command.regYear.toString());
            if (command.qid) await page.fill('#qid', command.qid.toString());

            await page.evaluate(() => processStep4());

            res.json({ stage: { screen: 'COMPLETE', message: command.message || "Processing your quote now. Thank you!" } });
            return;
        }

        res.json({ stage: { screen: currentStage, message: "I'm sorry, I didn't catch that or it's not applicable here. Please try again." } });

    } catch (err) {
        console.error("❌ Backend Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/automation-status', async (req, res) => {
    try {
        const page = await getActivePage();
        const screen = await detectCurrentStage(page);
        res.json({ screen, message: "System synced" });
    } catch (err) {
        res.json({ screen: "OFFLINE", message: "Browser error" });
    }
});

app.listen(3000, () => console.log('✅ Server running on http://localhost:3000'));