import React, { useState, useCallback } from 'react';
import { useQicVoiceLoop } from './hooks/useQicVoiceLoop';
import { speakResponse } from './utils/voiceOutput';
import { dispatchVoiceToGroq } from './service/groqRouter';
import './App.css'; 

const CAR_DATA = {
  "Toyota": ["Land Cruiser", "Camry", "Corolla", "Hilux"],
  "Nissan": ["Patrol", "Altima", "Sunny", "Pathfinder"],
  "Honda": ["Accord", "Civic", "CR-V"],
  "Ford": ["Explorer", "Mustang", "F-150"],
  "Other": ["Other"]
};

function App() {
  const [sysSpeaking, setSysSpeaking] = useState(false);
  const [activeScreen, setActiveScreen] = useState('GATEKEEPER'); 
  
  const [formData, setFormData] = useState({
    phone: '', plan: '', make: '', model: '', year: '', regYear: '', qid: ''
  });
  const [quotePrice, setQuotePrice] = useState(0);

  const resetFlow = useCallback(() => {
    setFormData({ phone: '', plan: '', make: '', model: '', year: '', regYear: '', qid: '' });
    setActiveScreen('GATEKEEPER');
    speakResponse("Process restarted. Please say or type your mobile number.", setSysSpeaking);
  }, []);

  const goBack = useCallback(() => {
    if (activeScreen === 'PLAN_SELECTION') {
      setActiveScreen('GATEKEEPER');
      speakResponse("Going back to Authentication.", setSysSpeaking);
    } else if (activeScreen === 'CAR_SPECS') {
      setActiveScreen('PLAN_SELECTION');
      speakResponse("Going back to Coverage Plan.", setSysSpeaking);
    } else if (activeScreen === 'REGISTRATION') {
      setActiveScreen('CAR_SPECS');
      speakResponse("Going back to Vehicle Details.", setSysSpeaking);
    } else {
      speakResponse("You are already at the beginning.", setSysSpeaking);
    }
  }, [activeScreen]);

  const processNextStep = (targetScreen, extractedData = {}) => {
    if (activeScreen === 'GATEKEEPER') {
      const phoneClean = (extractedData.phone || formData.phone || '').toString().replace(/\s/g, '');
      setFormData(prev => ({ ...prev, phone: phoneClean })); 

      if (!/^[35]\d{7}$/.test(phoneClean)) {
        speakResponse("Please provide a valid 8-digit mobile number starting with 3 or 5.", setSysSpeaking);
        return;
      }
      setActiveScreen('PLAN_SELECTION');
      speakResponse("Phone received. Please select Comprehensive or Third-Party coverage.", setSysSpeaking);
    } 
    else if (activeScreen === 'PLAN_SELECTION') {
      const updatedPlan = extractedData.plan || formData.plan;
      setFormData(prev => ({ ...prev, plan: updatedPlan }));

      if (!updatedPlan) {
        speakResponse("Please choose a coverage plan.", setSysSpeaking);
        return;
      }
      setActiveScreen('CAR_SPECS');
      speakResponse("Plan selected. What is your car make, model, and year?", setSysSpeaking);
    }
    else if (activeScreen === 'CAR_SPECS') {
      let updatedMake = extractedData.make || formData.make;
      let updatedModel = extractedData.model || formData.model;
      let updatedYear = extractedData.year || formData.year;

      if (extractedData.make && extractedData.make !== formData.make && !extractedData.model) {
        updatedModel = '';
      }

      if (updatedMake && !CAR_DATA[updatedMake]) {
        speakResponse(`We don't have ${updatedMake} in our list, marking as Other.`, setSysSpeaking);
        updatedMake = "Other";
        updatedModel = "Other";
      } else if (updatedModel && CAR_DATA[updatedMake] && !CAR_DATA[updatedMake].includes(updatedModel) && updatedModel !== "Other") {
        speakResponse(`We don't have ${updatedModel} under ${updatedMake}. Marking model as Other.`, setSysSpeaking);
        updatedModel = "Other";
      }

      setFormData(prev => ({ ...prev, make: updatedMake, model: updatedModel, year: updatedYear }));

      if (!updatedMake) {
        speakResponse("Please provide the car make.", setSysSpeaking); return;
      }
      if (!updatedModel) {
        speakResponse(`You selected ${updatedMake}. What is the model?`, setSysSpeaking); return;
      }
      const year = parseInt(updatedYear);
      if (!updatedYear || isNaN(year) || year < 1990 || year > new Date().getFullYear() + 1) {
        speakResponse(`You chose ${updatedMake} ${updatedModel}. What is the manufacturing year?`, setSysSpeaking); return;
      }
      
      setActiveScreen('REGISTRATION');
      speakResponse("Car details saved. Please provide your Registration Year and your 11-digit QID.", setSysSpeaking);
    }
    else if (activeScreen === 'REGISTRATION') {
      let updatedRegYear = extractedData.regYear || formData.regYear;
      let updatedQid = (extractedData.qid || formData.qid || '').toString().replace(/\s/g, '');

      setFormData(prev => ({ ...prev, regYear: updatedRegYear, qid: updatedQid }));

      const regYearInt = parseInt(updatedRegYear);
      if (!updatedRegYear || isNaN(regYearInt) || regYearInt < 1990 || regYearInt > new Date().getFullYear() + 1) {
        speakResponse("Please provide a valid registration year.", setSysSpeaking); return;
      }
      if (!/^\d{11}$/.test(updatedQid)) {
        speakResponse(`Registration year is ${updatedRegYear}. Now, please say your 11-digit QID.`, setSysSpeaking); return;
      }
      
      const isComp = (formData.plan || '').toLowerCase().includes('comp');
      const base = isComp ? 2000 + Math.floor(Math.random() * 500) : 600;
      setQuotePrice(base);
      
      setActiveScreen('COMPLETE');
      speakResponse(`Your quote is ready. You have chosen ${formData.plan} insurance. Your best rate is ${base} Riyals.`, setSysSpeaking);
    }
  };

  const handleUserVoiceInput = useCallback(async (rawVoiceText) => {
    if (!rawVoiceText.trim() || sysSpeaking) return;

    // PASS CAR_DATA TO GROQ FOR PHONETIC AUTOCORRECT
    const command = await dispatchVoiceToGroq(rawVoiceText, activeScreen, CAR_DATA);
    
    if (command.action === 'RESTART') { resetFlow(); return; }
    if (command.action === 'GO_BACK') { goBack(); return; }

    if (command.action === 'CLARIFICATION_NEEDED' || command.action === 'NONE') {
      speakResponse("I didn't quite catch that. Could you repeat?", setSysSpeaking);
      return;
    }

    if (command.action === 'SUBMIT_PHONE') processNextStep('PLAN_SELECTION', { phone: command.phoneNumber });
    else if (command.action === 'SELECT_PRODUCT') processNextStep('CAR_SPECS', { plan: command.productType });
    else if (command.action === 'SUBMIT_CAR_DETAILS') processNextStep('REGISTRATION', { make: command.carBrand, model: command.carModel, year: command.carYear });
    else if (command.action === 'GET_QUOTE') processNextStep('COMPLETE', { regYear: command.regYear, qid: command.qid });

  }, [activeScreen, sysSpeaking, formData, resetFlow, goBack]);

  const { isMicEnabled, toggleListening, liveTranscript } = useQicVoiceLoop(handleUserVoiceInput, sysSpeaking);

  return (
    <div className="app-container">
      <header>
        <div className="logo">Kavya Insurance Company</div>
        <div className="voice-badge">Voice Enabled 🎙️</div>
      </header>
      
      <div className="main-wrapper">
        <div className="stepper">
          {['Authentication', 'Coverage Plan', 'Vehicle Details', 'Registration'].map((title, idx) => {
            const stepScreens = ['GATEKEEPER', 'PLAN_SELECTION', 'CAR_SPECS', 'REGISTRATION', 'COMPLETE'];
            const currentIdx = stepScreens.indexOf(activeScreen);
            const isActive = currentIdx === idx;
            const isCompleted = currentIdx > idx;
            
            let value = '';
            if (idx === 0) value = formData.phone ? `+974 ${formData.phone}` : '';
            if (idx === 1) value = formData.plan;
            if (idx === 2) {
               const makeDisp = formData.make || '';
               const modelDisp = formData.model || '';
               const yearDisp = formData.year || '';
               value = `${makeDisp} ${modelDisp} ${yearDisp}`.trim();
            }
            if (idx === 3) value = formData.qid ? `QID: ${formData.qid}` : '';

            return (
              <div key={title} className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                <div className="step-circle">{isCompleted ? '✓' : idx + 1}</div>
                <div className="step-content">
                  <div className="step-title">{title}</div>
                  <div className="step-value">{value}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="form-container">


          {activeScreen === 'GATEKEEPER' && (
            <div className="step active">
              <h2>Enter your mobile number to begin</h2>
              
              <label>Mobile Number (8 digits, starts with 3 or 5)</label>
              <input 
                type="tel" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                placeholder="e.g., 33445566" 
                maxLength="8"
              />
              <button className="primary-btn" onClick={() => processNextStep('PLAN_SELECTION')} style={{marginTop: '10px'}}>Continue</button>
            </div>
          )}

          {activeScreen === 'PLAN_SELECTION' && (
            <div className="step active">
              <h2>Select Your Coverage</h2>
              <p>Choose the level of protection that fits your lifestyle.</p>
              <div className="btn-group">
                <button 
                  onClick={() => setFormData({...formData, plan: 'Comprehensive'})}
                  className={`coverage-btn ${formData.plan.includes('Comp') ? 'selected' : ''}`}
                >Comprehensive<br/><span style={{fontSize:'12px', fontWeight:'400', color: formData.plan.includes('Comp') ? '#fff':'#718096'}}>Premium full protection</span></button>
                <button 
                  onClick={() => setFormData({...formData, plan: 'Third-Party'})}
                  className={`coverage-btn ${formData.plan.includes('Third') ? 'selected' : ''}`}
                >Third-Party<br/><span style={{fontSize:'12px', fontWeight:'400', color: formData.plan.includes('Third') ? '#fff':'#718096'}}>Essential legal liability</span></button>
              </div>
              <div style={{display:'flex', gap:'15px', marginTop: '15px'}}>
                <button className="secondary-btn" onClick={goBack}>Back</button>
                <button className="primary-btn" onClick={() => processNextStep('CAR_SPECS')}>Confirm Plan</button>
              </div>
            </div>
          )}

          {activeScreen === 'CAR_SPECS' && (
            <div className="step active">
              <h2>Vehicle Specifications</h2>
              <p>Tell us about the vehicle you wish to insure.</p>
              <label>Make</label>
              <select value={formData.make} onChange={e => setFormData({...formData, make: e.target.value, model: ''})}>
                <option value="">Select Manufacturer</option>
                {Object.keys(CAR_DATA).map(brand => <option key={brand} value={brand}>{brand}</option>)}
                <option value="Other">Other</option>
              </select>

              <label>Model</label>
              <select value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})}>
                <option value="">Select Lineage</option>
                {formData.make && CAR_DATA[formData.make]?.map(model => <option key={model} value={model}>{model}</option>)}
                <option value="Other">Other</option>
              </select>

              <label>Manufacturing Year</label>
              <input 
                type="number" 
                value={formData.year} 
                onChange={e => setFormData({...formData, year: e.target.value})} 
                placeholder="e.g., 2024" 
              />
              <div style={{display:'flex', gap:'15px', marginTop: '15px'}}>
                <button className="secondary-btn" onClick={goBack}>Back</button>
                <button className="primary-btn" onClick={() => processNextStep('REGISTRATION')}>Save Vehicle Data</button>
              </div>
            </div>
          )}

          {activeScreen === 'REGISTRATION' && (
            <div className="step active">
              <h2>Final Details</h2>
              <p>Provide your official registration metrics to generate your final quote.</p>
              <label>Registration Year</label>
              <input 
                type="number" 
                value={formData.regYear} 
                onChange={e => setFormData({...formData, regYear: e.target.value})} 
                placeholder="e.g., 2024"
              />
              
              <label>QID Number (11 digits)</label>
              <input 
                type="text" 
                value={formData.qid} 
                onChange={e => setFormData({...formData, qid: e.target.value})} 
                placeholder="National ID Number" 
                maxLength="11"
              />
              <div style={{display:'flex', gap:'15px', marginTop: '15px'}}>
                <button className="secondary-btn" onClick={goBack}>Back</button>
                <button className="primary-btn" onClick={() => processNextStep('COMPLETE')}>Calculate Premium Quote</button>
              </div>
            </div>
          )}

          {activeScreen === 'COMPLETE' && (
            <div className="step active quote-result">
              <h2 style={{color: '#10B981'}}>Quote Generated Successfully</h2>
              <div className="quote-plan">{formData.plan} Motor Insurance</div>
              <div className="quote-amount"><span>QAR </span>{quotePrice.toLocaleString()}</div>
              <button className="primary-btn" onClick={resetFlow} style={{marginTop: '30px', padding: '16px 20px', width: 'auto'}}>Initiate New Application</button>
            </div>
          )}
        </div>
      </div>

      {liveTranscript && (
        <div className="live-transcript-box">
          "{liveTranscript}"
        </div>
      )}

      <button 
        className={`floating-mic ${isMicEnabled ? (sysSpeaking ? 'speaking' : 'listening') : ''}`}
        onClick={toggleListening}
      >
        {isMicEnabled ? (sysSpeaking ? '🔊 Agent Responding...' : '🎙️ Listening (Tap to Mute)') : '🎤 Muted (Tap to Speak)'}
      </button>
    </div>
  );
}

export default App;