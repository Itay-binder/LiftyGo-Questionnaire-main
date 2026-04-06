            (g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;
b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,
u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));
e.set("libraries",[...r]+"");
for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);
e.set("callback",c+".maps."+q);
a.src=`https://maps.${c}apis.com/maps/api/js?`+e;
d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));
m.head.append(a)}));
d[l]?console.warn(p+" only loads once. Ignoring:",g):
d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))
})
({ key: "AIzaSyBHPpbK5_Otha3gRC7n7sWwgnkIhyUC_uA", v: "weekly", language: "he", region: "IL" });

document.addEventListener('DOMContentLoaded', () => {
   
    // === UTM Injection ===
(function () {
  const KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'fbclid'
  ];

  const params = new URLSearchParams(window.location.search);

  KEYS.forEach(key => {
    const v = params.get(key);
    if (v) sessionStorage.setItem(key, v);
  });
})();

    const form = document.getElementById('mmwForm');
    const steps = document.querySelectorAll('.mmw-step');
    const progressBar = document.getElementById('mmwBar');
    const loader = document.getElementById('mmwLoader');
    const loaderTitle = document.getElementById('loaderTitle');
    const loaderSubtitle = document.getElementById('loaderSubtitle');
    const itemsContainer = document.getElementById('mmwItems');
    const addItemBtn = document.getElementById('mmwAddItem');

    let currentStep = 1;
    const totalSteps = steps.length;
    let moveType = null; 
    let pickupPlace = null;
    let dropoffPlace = null;
    let pendingNavigation = null; // ממתין לניווט אחרי בחירת כתובת
    let pickupAutocomplete = null; // שמירת autocomplete objects לגישה מהולידציה
    let dropoffAutocomplete = null;

    // משך הנפשה קצרה - 0ms כדי לבטל אותה במעבר משלב 1 ל-2
    const QUICK_ANIMATION_DURATION = 0; 
    const ACCESS_ANIMATION_DURATION = 1500; // 0.5 שניות לאנימציות של שלב 2->3 ו-3->4

    // === 0. Initial Setup ===
const generateOrderId = () => {
        if (window.__order_id) return window.__order_id;

        const phoneInput = document.querySelector('[name="phone"]');
        const phone = phoneInput ? phoneInput.value : '0000000000';
        const cleanPhone = phone.replace(/\D/g, '');

        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');

        const orderId =
            cleanPhone +
            '-' +
            pad(now.getDate()) +
            pad(now.getMonth() + 1) +
            now.getFullYear() +
            pad(now.getHours()) +
            pad(now.getMinutes()) +
            pad(now.getSeconds());

        window.__order_id = orderId;
        return orderId;
    };
    /** מילוי תיבות הבחירה של קומות */
    const fillFloorSelects = () => {
        const floorSelects = document.querySelectorAll('[name$="_floor"]');
        floorSelects.forEach(select => {
            select.innerHTML = '<option value="" selected disabled>בחר קומה</option>'; 
            for (let i = 1; i <= 20; i++) {
                select.innerHTML += `<option value="${i}">קומה ${i}</option>`;
            }
            select.innerHTML += '<option value="21+">21 ומעלה</option>';
        });
    };
    fillFloorSelects();
    
    /** מילוי תיבת הבחירה של קרטונים (בשלב הדירה) */
    const fillCartonsSelect = () => {
        const select = document.querySelector('[name="cartons"]');
        if (!select) return;
        select.innerHTML = '<option value="" selected disabled>בחר מספר</option>';
        select.innerHTML += '<option value="מעביר פריטים בודדים">מעביר פריטים בודדים</option>';
        select.innerHTML += '<option value="1 - 20 קרטונים">1 - 20 קרטונים</option>';
        select.innerHTML += '<option value="20 - 50 קרטונים">20 - 50 קרטונים</option>';
        select.innerHTML += '<option value="50 - 100 קרטונים">50 - 100 קרטונים</option>';
        select.innerHTML += '<option value="100 - 150 קרטונים">100 - 150 קרטונים</option>';
        select.innerHTML += '<option value="150 - 200 קרטונים">150 - 200 קרטונים</option>';
        select.innerHTML += '<option value="200+ קרטונים">200+ קרטונים</option>';
    };
    fillCartonsSelect();

    // === 1. Wizard Navigation Logic ===

    /** הפעלת הנפשת המשאית הקצרה */
    const runQuickAnimation = (title, subtitle) => {
        loaderTitle.textContent = title;
        loaderSubtitle.textContent = subtitle;
        loader.classList.add('quick-load', 'show');

        const duration = ACCESS_ANIMATION_DURATION; 

        return new Promise(resolve => {
            setTimeout(() => {
                loader.classList.remove('quick-load', 'show');
                resolve();
            }, duration);
        });
    };

    /** לוגיקה דינמית להסתרת קומה ונגישות - מוצג רק אם נבחר 'בניין' */
    const toggleAccessFields = (stepElement) => {
        const propertyTypeInput = stepElement.querySelector('input[name$="_type"]:checked');
        const isBuilding = propertyTypeInput && propertyTypeInput.value === 'בניין';
        
        const floorSelect = stepElement.querySelector('[name$="_floor"]');
        // קבוצת הרדיוסים של הנגישות, שולטת על ה-required
        const accessChips = stepElement.querySelectorAll('[data-group$="_access"] input'); 

        // לוגיקה: מסתיר את שדות הקומה והנגישות (שסומנו ב-data-type="building")
        // ומציג רק אם isBuilding הוא true.
        stepElement.querySelectorAll('[data-type="building"]').forEach(el => {
            // אם זה בניין, הצג. אחרת, הסתר.
            el.style.display = isBuilding ? 'grid' : 'none';
        });

        // עדכון מאפיין required לשדות קומה ונגישות
        if (floorSelect) {
            if (isBuilding) {
                floorSelect.setAttribute('required', true);
            } else {
                floorSelect.removeAttribute('required');
                floorSelect.value = ''; // איפוס הערך
            }
        }
        
        // הוספה/הסרה של required לשדות נגישות
        accessChips.forEach(input => {
            if (isBuilding) {
                input.setAttribute('required', true); 
            } else {
                input.removeAttribute('required');
            }
        });
    };


    // מניעת שליחה באמצעות Enter בשלבים שאינם האחרון
    // אבל לא מפריעים ל-Google Places Autocomplete לבחור כתובת
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const target = e.target;
            
            // אם זה שדה כתובת, Google Places מטפל ב-Enter בעצמו (לבחירת כתובת מהרשימה)
            if (target && (target.name === 'pickup' || target.name === 'dropoff')) {
                const pacContainer = document.querySelector('.pac-container');
                const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                                     pacContainer.children.length > 0;
                
                if (isPacVisible) {
                    // יש רשימה פתוחה - נסמן שיש pending navigation
                    // Google Places יבחר את הכתובת ואז place_changed יתבצע
                    pendingNavigation = {
                        step: currentStep,
                        direction: 1
                    };
                    // לא למנוע את ההתנהגות הטבעית של Google Places
                    // נמתין ל-place_changed event שיבצע את הניווט
                    return;
                } else {
                    // אין רשימה פתוחה, אפשר למנוע שליחה
                    if (currentStep !== totalSteps) {
                        e.preventDefault();
                        const nextButton = steps[currentStep - 1].querySelector('[data-next]');
                        if (nextButton) nextButton.click();
                    }
                }
                return;
            }
            
            // לשדות אחרים, מניעת שליחה רגילה
            if (currentStep !== totalSteps) { 
                e.preventDefault(); 
                const nextButton = steps[currentStep - 1].querySelector('[data-next]');
                if (nextButton) nextButton.click();
            }
        }
    });
    
    // טיפול נוסף ב-keyup כדי לטפל במקרה ש-Google Places לא בחר את הכתובת
    form.addEventListener('keyup', (e) => {
        if (e.key === 'Enter' && pendingNavigation) {
            const target = e.target;
            if (target && (target.name === 'pickup' || target.name === 'dropoff')) {
                // אם יש pending navigation אבל place_changed לא התבצע תוך זמן קצר,
                // נבטל את ה-pending navigation (המשתמש לא בחר מהרשימה)
                setTimeout(() => {
                    if (pendingNavigation && pendingNavigation.step === currentStep) {
                        pendingNavigation = null;
                    }
                }, 300);
            }
        }
    });
    
    // מעבר מיידי לשלב הבא בלחיצה על סוג ההובלה (שלב 1)
    document.querySelectorAll('[data-auto-next]').forEach(chipLabel => {
        chipLabel.addEventListener('click', (e) => { 
            const radio = chipLabel.querySelector('input[type="radio"]');
            
            if (radio && radio.checked) return; 

            if (radio && currentStep === 1) {
                radio.checked = true;
                updateChipState(radio);
                
                moveType = document.querySelector('input[name="move_type"]:checked').value;
                toggleContentStep(moveType);
                
                setTimeout(() => {
                     navigate(1);
                }, 10);
               
            }
        });
    });


    /** מעבר לשלב הבא או הקודם */
    const navigate = (direction) => {
        let nextStep = currentStep + direction; // השתמש ב-let כי nextStep יכול להשתנות
        
        // אם יש pending navigation לשלב הנוכחי, נדלג על הולידציה
        // כי זה אומר ש-place_changed עדיין לא התעדכן
        const hasPendingNav = pendingNavigation && pendingNavigation.step === currentStep;
        
        if (direction > 0 && !hasPendingNav && !validateStep(currentStep)) {
             window.scrollTo({ top: 0, behavior: 'smooth' });
             return; 
        }

        if (nextStep < 1 || nextStep > totalSteps) return;

        steps[currentStep - 1].classList.remove('active');
        currentStep = nextStep;
        steps[currentStep - 1].classList.add('active');
        // אם חזרנו לשלב 1 – מנקה בחירה
if(currentStep === 1){
    document.querySelectorAll('input[name="move_type"]').forEach(r => {
        r.checked = false;
    });
    document.querySelectorAll('[data-group="move_type"] .mmw-chip')
        .forEach(c => c.classList.remove('active'));

    moveType = null;
}

        // הפעלת הלוגיקה הדינמית לאחר המעבר לשלב 2 או 3 (איסוף או יעד)
        if (currentStep === 2 || currentStep === 3) {
             toggleAccessFields(steps[currentStep - 1]);
        }
        
        updateProgress();
        
        // Initialize items step when entering step 4 (only for small moves)
        // Do this after step visibility is set to prevent visual glitches
        if (currentStep === 4) {
            const isSmallMove = (moveType === 'הובלה קטנה');
            if (isSmallMove) {
                // Use requestAnimationFrame to ensure step is fully rendered
                requestAnimationFrame(() => {
                    initializeItemsStep();
                });
            }
        }
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    /** עדכון סרגל ההתקדמות */
    const updateProgress = () => {
        const percent = (currentStep - 1) / (totalSteps - 1) * 100;
        progressBar.style.width = `${percent}%`;
    };

    /** שינוי תוכן שלב 4 בהתאם לבחירה (דירה/קטנה) */
    const toggleContentStep = (type) => {
        const step = document.querySelector('[data-step="4"]');
        const smallMoveElements = step.querySelectorAll('.small-move');
        const apartmentMoveElement = step.querySelector('.apartment-move');
        
        const isSmallMove = (type === 'הובלה קטנה');

        smallMoveElements.forEach(el => el.style.display = isSmallMove ? '' : 'none');
        apartmentMoveElement.style.display = isSmallMove ? 'none' : '';
        
        const cartonsSelect = apartmentMoveElement.querySelector('select[name="cartons"]');
        const firstItemInput = step.querySelector('.small-move [name="item_name_0"]');
        
        // עדכון ה-Required
        if (isSmallMove) {
            cartonsSelect.removeAttribute('required');
            if (firstItemInput) firstItemInput.setAttribute('required', true); 
        } else {
            cartonsSelect.setAttribute('required', true);
            step.querySelectorAll('.small-move input[name^="item_name_"]').forEach(input => input.removeAttribute('required'));
        }
    };
    
    /** טיפול במצבי בחירה של צ'יפים */
    const updateChipState = (input) => {
        const chip = input.closest('.mmw-chip');
        if (!chip) return;

        if (input.type === 'radio' && input.checked) {
            chip.closest('.mmw-checks').querySelectorAll('.mmw-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
        } else if (input.type === 'checkbox') {
            chip.classList.toggle('active', input.checked);
        }
    };
    
    /** ולידציה של השלב הנוכחי */
    const validateStep = (step, skipPlaceCheck = false) => {
        
        const currentStepElement = steps[step - 1];
        let isValid = true;
        
        // אם יש pending navigation לשלב הזה, נדלג על בדיקת הכתובת
        // כי זה אומר ש-place_changed עדיין לא התעדכן
        const hasPendingNav = pendingNavigation && pendingNavigation.step === step;
        const shouldSkipPlaceCheck = skipPlaceCheck || hasPendingNav;
        
        const requiredInputs = currentStepElement.querySelectorAll('[required]');
        requiredInputs.forEach(input => {
            const parentField = input.closest('.mmw-field');
            if (parentField && parentField.style.display === 'none') {
                 return;
            }

            if (input.type === 'radio') {
                const groupName = input.name;
                if (!currentStepElement.querySelector(`input[name="${groupName}"]:checked`)) {
                    const isFirstRequired = currentStepElement.querySelector(`input[name="${groupName}"][required]`) === input;
                    if (isFirstRequired) {
                        input.reportValidity(); 
                        isValid = false;
                    }
                }
            } else if (!input.value) {
                input.reportValidity(); 
                isValid = false;
            }
        });
         // ✅ בדיקה מחייבת לבחירה מגוגל – בשלב 2 (איסוף) ו-3 (יעד)
         // אם shouldSkipPlaceCheck הוא true, נדלג על הבדיקה
  if (!shouldSkipPlaceCheck) {
    if (step === 2) {
      const pickupInput = document.querySelector('input[name="pickup"]');
      
      // בדיקה: אם יש pickupPlace, נבדוק שהערך ב-input תואם את הערך שנבחר
      if (pickupPlace && pickupPlace.formatted_address && pickupInput && pickupInput.value.trim()) {
        if (pickupInput.value.trim() !== pickupPlace.formatted_address.trim()) {
          // הערך השתנה - נאפס את pickupPlace ונציג הודעה
          pickupPlace = null;
          pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
          pickupInput.reportValidity();
          return false;
        }
      }
      
      // אם יש ערך ב-input אבל אין pickupPlace, ננסה לקבל את ה-place ישירות מה-autocomplete
      if (!pickupPlace && pickupInput && pickupInput.value.trim()) {
        if (pickupAutocomplete) {
          try {
            const place = pickupAutocomplete.getPlace();
            if (place && place.geometry) {
              pickupPlace = place;
            } else {
              // אם עדיין אין place, נבדוק אם יש רשימה פתוחה (משתמש בחר אבל place_changed עוד לא התבצע)
              const pacContainer = document.querySelector('.pac-container');
              const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                                   pacContainer.children.length > 0;
              if (!isPacVisible) {
                if (pickupInput) {
                  pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
                  pickupInput.reportValidity();
                }
                return false;
              }
              // אם יש רשימה פתוחה, נמתין קצת - place_changed יתבצע בקרוב
              return false; // נחזיר false כדי למנוע ניווט, place_changed יבצע את הניווט אחר כך
            }
          } catch (e) {
            // אם יש שגיאה, נבדוק אם יש רשימה פתוחה
            const pacContainer = document.querySelector('.pac-container');
            const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                                 pacContainer.children.length > 0;
            if (!isPacVisible) {
              if (pickupInput) {
                pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
                pickupInput.reportValidity();
              }
              return false;
            }
            return false; // נמתין ל-place_changed
          }
        } else {
          // אם אין autocomplete עדיין, נבדוק אם יש ערך
          if (!pickupInput.value.trim()) {
            pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
            pickupInput.reportValidity();
            return false;
          }
        }
      } else if (!pickupPlace) {
        // לפני הצגת הודעה, נבדוק אם יש רשימה פתוחה (משתמש בחר אבל place_changed עוד לא התבצע)
        const pacContainer = document.querySelector('.pac-container');
        const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                             pacContainer.children.length > 0;
        if (!isPacVisible) {
          // אין רשימה פתוחה - נציג הודעה
          if (pickupInput) {
            pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
            pickupInput.reportValidity();
          }
        }
        // אם יש רשימה פתוחה, נמתין ל-place_changed (לא נציג הודעה)
        return false;
      }
    }
    if (step === 3) {
      const dropoffInput = document.querySelector('input[name="dropoff"]');
      
      // בדיקה: אם יש dropoffPlace, נבדוק שהערך ב-input תואם את הערך שנבחר
      if (dropoffPlace && dropoffPlace.formatted_address && dropoffInput && dropoffInput.value.trim()) {
        if (dropoffInput.value.trim() !== dropoffPlace.formatted_address.trim()) {
          // הערך השתנה - נאפס את dropoffPlace ונציג הודעה
          dropoffPlace = null;
          dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
          dropoffInput.reportValidity();
          return false;
        }
      }
      
      // אם יש ערך ב-input אבל אין dropoffPlace, ננסה לקבל את ה-place ישירות מה-autocomplete
      if (!dropoffPlace && dropoffInput && dropoffInput.value.trim()) {
        if (dropoffAutocomplete) {
          try {
            const place = dropoffAutocomplete.getPlace();
            if (place && place.geometry) {
              dropoffPlace = place;
            } else {
              // אם עדיין אין place, נבדוק אם יש רשימה פתוחה (משתמש בחר אבל place_changed עוד לא התבצע)
              const pacContainer = document.querySelector('.pac-container');
              const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                                   pacContainer.children.length > 0;
              if (!isPacVisible) {
                if (dropoffInput) {
                  dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
                  dropoffInput.reportValidity();
                }
                return false;
              }
              // אם יש רשימה פתוחה, נמתין קצת - place_changed יתבצע בקרוב
              return false; // נחזיר false כדי למנוע ניווט, place_changed יבצע את הניווט אחר כך
            }
          } catch (e) {
            // אם יש שגיאה, נבדוק אם יש רשימה פתוחה
            const pacContainer = document.querySelector('.pac-container');
            const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                                 pacContainer.children.length > 0;
            if (!isPacVisible) {
              if (dropoffInput) {
                dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
                dropoffInput.reportValidity();
              }
              return false;
            }
            return false; // נמתין ל-place_changed
          }
        } else {
          // אם אין autocomplete עדיין, נבדוק אם יש ערך
          if (!dropoffInput.value.trim()) {
            dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
            dropoffInput.reportValidity();
            return false;
          }
        }
      } else if (!dropoffPlace) {
        // לפני הצגת הודעה, נבדוק אם יש רשימה פתוחה (משתמש בחר אבל place_changed עוד לא התבצע)
        const pacContainer = document.querySelector('.pac-container');
        const isPacVisible = pacContainer && pacContainer.style.display !== 'none' && 
                             pacContainer.children.length > 0;
        if (!isPacVisible) {
          // אין רשימה פתוחה - נציג הודעה
          if (dropoffInput) {
            dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
            dropoffInput.reportValidity();
          }
        }
        // אם יש רשימה פתוחה, נמתין ל-place_changed (לא נציג הודעה)
        return false;
      }
    }
  }
        
        const isSmallMove = (moveType === 'הובלה קטנה');

        if (step === 4 && isSmallMove) {
            const itemNames = currentStepElement.querySelectorAll('.small-move [name^="item_name_"]');
            const hasValidItem = Array.from(itemNames).some(input => input.value.trim() !== '');
            if (!hasValidItem) {
                alert('אנא הוסף לפחות פריט אחד עם שם.');
                isValid = false;
            }
        }

        return isValid;
       

    };

    // איתור כפתורי ניווט (הבא/הקודם)
    document.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', async (e) => {
        e.preventDefault(); 
        if (validateStep(currentStep)) {
            // Navigate directly without animation
            navigate(1);
        } else {
             window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }));
    document.querySelectorAll('[data-prev]').forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault(); 
        navigate(-1);
    }));
    
    // איתור והפעלת צ'יפים + טיפול בטקסט חופשי (אחר)
    document.querySelectorAll('.mmw-chip input').forEach(input => {
        updateChipState(input); 

        input.addEventListener('change', (e) => {
            updateChipState(e.target);
            const chip = e.target.closest('.mmw-chip');
            const freeTextInputName = chip ? chip.getAttribute('data-free-text') : null;
            
            const allFreeTextInputs = chip ? chip.closest('.mmw-field').querySelectorAll('input[type="text"][name$="_other"]') : [];
            
            allFreeTextInputs.forEach(input => {
                 input.style.display = 'none';
                 input.removeAttribute('required'); 
            });
            
            if (freeTextInputName && e.target.value === 'אחר' && e.target.checked) {
                const freeTextInput = document.querySelector(`input[name="${freeTextInputName}"]`);
                if (freeTextInput) {
                    freeTextInput.style.display = 'block';
                    freeTextInput.setAttribute('required', true); 
                    freeTextInput.focus();
                }
            }
            
            // *** לוגיקה דינמית לבית קרקע / בניין ***
            if (e.target.closest('[data-section="property-type"]')) {
                toggleAccessFields(e.target.closest('.mmw-step'));
            }
            // *** סוף לוגיקה דינמית ***
            
            // *** לוגיקה דינמית למנוף ***
            if (e.target.name === 'needs_crane') {
                const craneReasonInput = document.querySelector('input[name="crane_reason"]');
                if (craneReasonInput) {
                    if (e.target.checked) {
                        craneReasonInput.style.display = 'block';
                    } else {
                        craneReasonInput.style.display = 'none';
                        craneReasonInput.value = ''; // איפוס הערך
                    }
                }
            }
            // *** סוף לוגיקה דינמית למנוף ***
        });
    });

    // === 2. Item Management Logic (שלב 5 - קטנה) ===

    const MAX_IMAGE_DIMENSION = 1920;
    const JPEG_QUALITY = 0.82;

    function safeDriveBaseName(name) {
        const t = String(name || '').trim() || 'item';
        return t.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    function compressImageFileToJpeg(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('not an image'));
                return;
            }
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                let { width, height } = img;
                const max = MAX_IMAGE_DIMENSION;
                if (width > max || height > max) {
                    if (width >= height) {
                        height = Math.round((height * max) / width);
                        width = max;
                    } else {
                        width = Math.round((width * max) / height);
                        height = max;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
                const comma = dataUrl.indexOf('base64,');
                if (comma === -1) {
                    reject(new Error('toDataURL failed'));
                    return;
                }
                resolve({
                    base64: dataUrl.slice(comma + 7),
                    mime_type: 'image/jpeg'
                });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('image load failed'));
            };
            img.src = url;
        });
    }

    function renderRowPreviews(row) {
        const wrap = row.querySelector('.previews');
        if (!wrap) return;
        wrap.innerHTML = '';
        const imgs = row._itemImages || [];
        imgs.forEach((imgData, i) => {
            const holder = document.createElement('div');
            holder.className = 'preview-thumb-wrap';
            const thumb = document.createElement('img');
            thumb.className = 'preview-thumb';
            thumb.src = 'data:' + imgData.mime_type + ';base64,' + imgData.base64;
            thumb.alt = 'תמונה ' + (i + 1);
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'thumb-remove';
            removeBtn.setAttribute('aria-label', 'הסר תמונה');
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                ev.preventDefault();
                row._itemImages.splice(i, 1);
                renderRowPreviews(row);
            });
            holder.appendChild(thumb);
            holder.appendChild(removeBtn);
            wrap.appendChild(holder);
        });
    }

    /** יצירת שורת פריט חדשה */
    let isCreatingRow = false; // Guard to prevent double execution
    const createItemRow = () => {
        // Prevent double execution
        if (isCreatingRow) return;
        isCreatingRow = true;
        
        try {
            const index = itemsContainer.querySelectorAll('.row').length;
            const row = document.createElement('div');
            row.className = 'row';
            const requiredAttr = index === 0 ? 'required' : ''; 
            row.innerHTML = `
                <input type="text" class="mmw-input" name="item_name_${index}" placeholder="שם פריט" ${requiredAttr} />
                <select class="mmw-select" name="item_qty_${index}">
                    <option value="1">1</option><option value="2">2</option><option value="3">3</option>
                    <option value="4">4</option><option value="5">5</option><option value="6">6</option>
                    <option value="7">7</option><option value="8">8</option><option value="9">9</option>
                    <option value="10+">10+</option>
                </select>
                <div class="img-wrap">
                    <input type="file" accept="image/*" multiple class="mmw-img-input" style="display:none" data-index="${index}" />
                    <button type="button" class="img-btn" title="הוספת תמונות (מצלמה או גלריה)">📸</button>
                    <div class="previews" aria-live="polite"></div>
                </div>
                <button type="button" class="del" title="מחיקת פריט">✖</button>
            `;

            row._itemImages = [];

            row.querySelector('.del').addEventListener('click', () => {
                 row.remove();
                 const firstItem = itemsContainer.querySelector('.row [name^="item_name_"]');
                 if (firstItem) firstItem.setAttribute('required', true);
            });

            const imgBtn = row.querySelector('.img-btn');
            const fileInput = row.querySelector('.mmw-img-input');

            imgBtn.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (!files || !files.length) return;
                for (const file of files) {
                    if (!file.type.startsWith('image/')) continue;
                    try {
                        const compressed = await compressImageFileToJpeg(file);
                        row._itemImages.push(compressed);
                    } catch (err) {
                        console.warn('[Item Row] דילוג על תמונה (דחיסה/טעינה נכשלה):', err);
                    }
                }
                e.target.value = '';
                renderRowPreviews(row);
            });

            itemsContainer.appendChild(row);
        } finally {
            // Reset guard immediately after row creation (or on error)
            isCreatingRow = false;
        }
    };

    // Initialize items container only when entering step 5
    const initializeItemsStep = () => {
        if (!itemsContainer || !addItemBtn) return;
        
        // Only create one row if container is completely empty
        // This preserves any items user has already added
        const existingRows = itemsContainer.querySelectorAll('.row');
        if (existingRows.length === 0) {
            createItemRow();
        }
    };

    if (addItemBtn) {
        // Use once: true to prevent duplicate listeners, and stop propagation
        addItemBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            createItemRow();
        }, { once: false });
    }
    function extractBase64Image(dataUrl) {
        console.log('[Extract Base64] Input:', {
            dataUrl: dataUrl ? dataUrl.substring(0, 100) + '...' : 'null',
            type: typeof dataUrl,
            length: dataUrl ? dataUrl.length : 0
        });
        
        if (!dataUrl || typeof dataUrl !== 'string') {
            console.log('[Extract Base64] Invalid input - returning null');
            return { base64: null, type: null };
        }

        const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);

        if (!match) {
            console.warn('[Extract Base64] No match found for data URL pattern');
            console.warn('[Extract Base64] Data URL preview:', dataUrl.substring(0, 100));
            return { base64: null, type: null };
        }

        const result = {
            base64: match[2],
            type: match[1]
        };
        
        console.log('[Extract Base64] ✅ Success:', {
            type: result.type,
            base64Length: result.base64 ? result.base64.length : 0
        });

        return result;
    }

    // === Google Drive Upload Configuration ===
    // ⚠️ חשוב: עדכן את הכתובת לכתובת ה-API של וורדפרס שלך
    const DRIVE_UPLOAD_API_URL = 'https://liftygo.co.il/wp-json/liftygo/v1/create-folder-and-upload';
    
    /**
     * יצירת תיקייה והעלאת תמונות לגוגל דרייב
     * @param {string} customerName - שם הלקוח
     * @param {string} orderDate - תאריך הזמנה (YYYY-MM-DD)
     * @param {Array} files - מערך של קבצים (base64, filename, mime_type)
     * @returns {Promise<Object|null>} - אובייקט עם folder_url, folder_id וכו' או null אם נכשל
     */
    const createFolderAndUploadToDrive = async (customerName, orderDate, files) => {
        if (!customerName || !orderDate) {
            console.warn('[Drive Upload] Missing customer name or order date', { customerName, orderDate });
            return null;
        }
        
        // אם אין קבצים, לא ניצור תיקייה
        if (!files || files.length === 0) {
            console.log('[Drive Upload] No files to upload, skipping folder creation');
            return null;
        }
        
        console.log('[Drive Upload] Starting upload:', {
            customerName,
            orderDate,
            filesCount: files.length,
            files: files.map(f => ({ filename: f.filename, mime_type: f.mime_type, base64_length: f.base64 ? f.base64.length : 0 }))
        });
        
        // בדיקת תקינות הקבצים לפני שליחה
        const validFiles = files.filter(f => f.base64 && f.filename && f.mime_type);
        if (validFiles.length === 0) {
            console.warn('[Drive Upload] ⚠️ No valid files to upload after filtering');
            return null;
        }
        
        console.log('[Drive Upload] Valid files count:', validFiles.length);
        
        const filesToSend = validFiles;
        
        try {
            const requestBody = {
                customer_name: customerName,
                order_date: orderDate,
                files: filesToSend
            };
            
            console.log('[Drive Upload] ⚠️⚠️⚠️ ABOUT TO SEND REQUEST TO PHP');
            console.log('[Drive Upload] URL:', DRIVE_UPLOAD_API_URL);
            console.log('[Drive Upload] Request body size:', JSON.stringify(requestBody).length, 'bytes');
            console.log('[Drive Upload] Files count in request:', requestBody.files ? requestBody.files.length : 0);
            
            let response;
            try {
                console.log('[Drive Upload] ⚠️⚠️⚠️ CALLING FETCH NOW...');
                console.log('[Drive Upload] Fetch options:', {
                    method: 'POST',
                    url: DRIVE_UPLOAD_API_URL,
                    headers: { 'Content-Type': 'application/json' },
                    bodySize: JSON.stringify(requestBody).length
                });
                
                response = await fetch(DRIVE_UPLOAD_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody)
                });
                
                console.log('[Drive Upload] ⚠️⚠️⚠️ FETCH COMPLETED - RESPONSE RECEIVED FROM PHP');
                console.log('[Drive Upload] Response object:', response);
                console.log('[Drive Upload] Response type:', typeof response);
            } catch (fetchError) {
                console.error('[Drive Upload] ❌❌❌ FETCH ERROR - Request failed completely!');
                console.error('[Drive Upload] Fetch error type:', fetchError.constructor.name);
                console.error('[Drive Upload] Fetch error message:', fetchError.message);
                console.error('[Drive Upload] Fetch error name:', fetchError.name);
                console.error('[Drive Upload] Fetch error stack:', fetchError.stack);
                console.error('[Drive Upload] This could be: CORS error, network error, or server not responding');
                console.error('[Drive Upload] Check Network tab in DevTools to see if request was sent');
                return null;
            }
            
            console.log('[Drive Upload] ⚠️⚠️⚠️ RESPONSE RECEIVED FROM PHP');
            
            console.log('[Drive Upload] Response status:', response.status, response.statusText);
            console.log('[Drive Upload] Response headers:', Object.fromEntries(response.headers.entries()));
            
            let responseText;
            try {
                console.log('[Drive Upload] ⚠️⚠️⚠️ READING RESPONSE TEXT...');
                responseText = await response.text();
                console.log('[Drive Upload] ⚠️⚠️⚠️ RAW RESPONSE TEXT (full):', responseText);
            } catch (textError) {
                console.error('[Drive Upload] ❌❌❌ ERROR READING RESPONSE TEXT!');
                console.error('[Drive Upload] Text error:', textError);
                console.error('[Drive Upload] Response might be empty or corrupted');
                return null;
            }
            console.log('[Drive Upload] Raw response text length:', responseText.length);
            console.log('[Drive Upload] Raw response text (first 500):', responseText.substring(0, 500));
            console.log('[Drive Upload] Raw response text (last 500):', responseText.substring(Math.max(0, responseText.length - 500)));
            console.log('[Drive Upload] Response status:', response.status);
            console.log('[Drive Upload] Response statusText:', response.statusText);
            console.log('[Drive Upload] Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                console.error('[Drive Upload] ❌❌❌ FAILED RESPONSE STATUS:', response.status);
                console.error('[Drive Upload] Failed response text (full):', responseText);
                try {
                    const errorData = JSON.parse(responseText);
                    console.error('[Drive Upload] Failed error data:', errorData);
                } catch (e) {
                    console.error('[Drive Upload] Failed to parse error response:', e);
                    console.error('[Drive Upload] Response might not be JSON!');
                }
                return null;
            }
            
            let result;
            try {
                // ⚠️⚠️⚠️ CRITICAL: ננסה לפרסר את ה-JSON
                console.log('[Drive Upload] ⚠️⚠️⚠️ Attempting to parse JSON...');
                console.log('[Drive Upload] Response text before parse:', responseText);
                
                result = JSON.parse(responseText);
                
                console.log('[Drive Upload] ✅✅✅ PARSED RESPONSE SUCCESSFULLY!');
                console.log('[Drive Upload] Response type:', typeof result);
                console.log('[Drive Upload] Response is array:', Array.isArray(result));
                console.log('[Drive Upload] Response is null:', result === null);
                console.log('[Drive Upload] Response keys:', result ? Object.keys(result) : 'null');
                console.log('[Drive Upload] Response has folder_id:', !!result.folder_id);
                console.log('[Drive Upload] Response has folder_url:', !!result.folder_url);
                console.log('[Drive Upload] Response folder_id value:', result.folder_id);
                console.log('[Drive Upload] Response folder_url value:', result.folder_url);
                console.log('[Drive Upload] Response success value:', result.success);
                console.log('[Drive Upload] Response files_count:', result.files_count);
                console.log('[Drive Upload] Full response object:', result);
                console.log('[Drive Upload] Full response JSON:', JSON.stringify(result, null, 2));
            } catch (e) {
                console.error('[Drive Upload] ❌❌❌ FAILED TO PARSE JSON RESPONSE!');
                console.error('[Drive Upload] Parse error:', e);
                console.error('[Drive Upload] Parse error message:', e.message);
                console.error('[Drive Upload] Response text was (full):', responseText);
                console.error('[Drive Upload] Response text length:', responseText.length);
                console.error('[Drive Upload] Response text type:', typeof responseText);
                return null;
            }
            
            // בדיקה אם התגובה היא אובייקט או מערך
            // WordPress REST API אמור להחזיר אובייקט, אבל נבדוק למקרה של edge case
            if (Array.isArray(result)) {
                console.warn('[Drive Upload] ⚠️ Response is an array, taking first element');
                result = result[0];
            }
            
            // בדיקה נוספת - אולי הנתונים נמצאים בתוך wrapper (לא אמור לקרות אבל נבדוק)
            if (result && typeof result === 'object' && !result.folder_id) {
                // נבדוק אם יש wrapper כמו data או response
                if (result.data && result.data.folder_id) {
                    console.log('[Drive Upload] Found folder_id in result.data, using it');
                    result = result.data;
                } else if (result.response && result.response.folder_id) {
                    console.log('[Drive Upload] Found folder_id in result.response, using it');
                    result = result.response;
                }
            }
            
            // אם יש folder_id אבל אין folder_url, נבנה את ה-URL
            if (result && result.folder_id && !result.folder_url) {
                result.folder_url = 'https://drive.google.com/drive/folders/' + result.folder_id;
                console.log('[Drive Upload] ✅ Constructed folder_url from folder_id:', result.folder_url);
            }
            
            // אם יש folder_id, נחזיר את התוצאה גם אם success הוא false או חסר
            // זה חשוב כי גם אם הקבצים לא הועלו, התיקייה עדיין נוצרה
            if (result && result.folder_id) {
                // אם אין folder_url, נבנה אותו מ-folder_id
                if (!result.folder_url) {
                    result.folder_url = 'https://drive.google.com/drive/folders/' + result.folder_id;
                    console.log('[Drive Upload] Constructed folder_url from folder_id:', result.folder_url);
                }
                
                // נסמן כמוצלח כי התיקייה קיימת (גם אם הקבצים לא הועלו)
                result.success = true;
                
                // נוודא שיש ערכים ברירת מחדל
                result.folder_name = result.folder_name || '';
                result.files_count = result.files_count || 0;
                
                console.log('[Drive Upload] ✅ Success - returning result (folder created):', {
                    folder_url: result.folder_url,
                    folder_id: result.folder_id,
                    folder_name: result.folder_name,
                    files_count: result.files_count,
                    success: result.success
                });
                
                // אם הקבצים לא הועלו, נדווח על זה
                if (result.files_count === 0 && files && files.length > 0) {
                    console.warn('[Drive Upload] ⚠️ Warning: Folder created but no files were uploaded!', {
                        expected_files: files.length,
                        uploaded_files: result.files_count
                    });
                }
                
                return result;
            } else {
                console.error('[Drive Upload] ❌❌❌ CRITICAL ERROR - Response missing folder_id!');
                console.error('[Drive Upload] Full response object:', result);
                console.error('[Drive Upload] Response type:', typeof result);
                console.error('[Drive Upload] Response is array:', Array.isArray(result));
                console.error('[Drive Upload] Response keys:', result ? Object.keys(result) : 'null');
                console.error('[Drive Upload] Full response JSON:', JSON.stringify(result, null, 2));
                
                // אם יש שגיאה אבל התיקייה עדיין נוצרה, ננסה לבדוק אם יש מידע אחר
                if (result && result.error) {
                    console.error('[Drive Upload] Error in response:', result.error);
                }
                
                // ניסיון אחרון - אולי folder_id נמצא במקום אחר?
                if (result) {
                    console.error('[Drive Upload] Trying to find folder_id in different places...');
                    console.error('[Drive Upload] result.data?.folder_id:', result.data?.folder_id);
                    console.error('[Drive Upload] result.response?.folder_id:', result.response?.folder_id);
                    console.error('[Drive Upload] result.body?.folder_id:', result.body?.folder_id);
                }
                
                return null;
            }
        } catch (error) {
            console.error('[Drive Upload] ❌❌❌ UNEXPECTED ERROR IN createFolderAndUploadToDrive!');
            console.error('[Drive Upload] Error type:', error.constructor.name);
            console.error('[Drive Upload] Error name:', error.name);
            console.error('[Drive Upload] Error message:', error.message);
            console.error('[Drive Upload] Error stack:', error.stack);
            console.error('[Drive Upload] Full error object:', error);
            
            // אם זו שגיאת רשת או CORS, נדווח על זה
            if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('CORS') || error.message.includes('message channel'))) {
                console.error('[Drive Upload] ⚠️ This looks like a network/CORS/channel error!');
                console.error('[Drive Upload] Check Network tab in DevTools to see if request was sent');
                console.error('[Drive Upload] Check if server is responding and CORS headers are correct');
            }
            
            return null;
        }
    };


    // === 3. Data Collection and Submission ===

    /** איסוף הנתונים ל-Payload */
    const collectPayload = () => {
        const formData = new FormData(form);
        const payload = {};
        const items = [];

                payload.order_id = generateOrderId();

        payload.move_type = formData.get('move_type');
        payload.pickup = formData.get('pickup');
        payload.dropoff = formData.get('dropoff');
        payload.date = formData.get('date');

        // בדיקה אם ההובלה דחופה (היום או מחר)
        const requestedDate = formData.get('date');
        if (requestedDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const requestDate = new Date(requestedDate);
            requestDate.setHours(0, 0, 0, 0);
            const diffTime = requestDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // אם התאריך הוא היום (0 ימים) או מחר (1 יום) -> דחוף
            if (diffDays <= 1) {
                payload.is_urgent = 'דחוף';
            } else {
                payload.is_urgent = 'לא דחוף';
            }
        } else {
            payload.is_urgent = 'לא ידוע';
        }

        // טיפול במנוף
        const needsCrane = formData.get('needs_crane') === 'כן';
        const craneReason = formData.get('crane_reason') || '';
        if (needsCrane) {
            payload.crane_info = 'צריך מנוף' + (craneReason ? ' | פירוט: ' + craneReason : '');
            payload.needs_crane = 'כן';
        } else {
            payload.crane_info = 'לא צריך מנוף';
            payload.needs_crane = 'לא';
        }

        payload.name = formData.get('name');
        payload.phone = formData.get('phone');
        payload.notes = formData.get('notes'); payload.what_moving = formData.get('what_moving') || '';
        payload.terms_approved = formData.get('terms_approved') || '';

        payload.utm_source = formData.get('utm_source');
        payload.utm_medium = formData.get('utm_medium');
        payload.utm_campaign = formData.get('utm_campaign');
        payload.utm_content = formData.get('utm_content');
        payload.event_id = formData.get('event_id');
        payload.fbp = formData.get('fbp');
        payload.fbc = formData.get('fbc');
        payload.fbclid = formData.get('fbclid');


        const getAccessValue = (name) => {
            const val = formData.get(name);
            if (val === 'אחר') {
                return formData.get(`${name}_other`);
            }
            return val;
        }

        payload.pickup_type = formData.get('pickup_type');
        payload.pickup_floor = payload.pickup_type === 'בית קרקע' ? 'קרקע' : formData.get('pickup_floor');
        // נגישות רלוונטית רק אם נבחר 'בניין'
        payload.pickup_access = payload.pickup_type === 'בית קרקע' ? 'לא רלוונטי' : getAccessValue('pickup_access'); 
        
        payload.drop_type = formData.get('drop_type');
        payload.drop_floor = payload.drop_type === 'בית קרקע' ? 'קרקע' : formData.get('drop_floor');
        payload.drop_access = payload.drop_type === 'בית קרקע' ? 'לא רלוונטי' : getAccessValue('drop_access');

        // איסוף פריטים או קרטונים בהתאם לסוג ההובלה
        const isSmallMove = (payload.move_type === 'הובלה קטנה');

        if (isSmallMove) {
            document.querySelectorAll('.mmw-items .row').forEach((row, index) => {
                const itemName = formData.get(`item_name_${index}`);
                const itemQty = formData.get(`item_qty_${index}`);
                if (!itemName || !itemQty) return;

                const rowImages = Array.isArray(row._itemImages) ? row._itemImages : [];
                const images = rowImages
                    .filter((im) => im && im.base64 && im.mime_type && im.mime_type.startsWith('image/'))
                    .map((im) => ({ image_base64: im.base64, image_type: im.mime_type }));

                const item = {
                    name: itemName,
                    quantity: itemQty,
                    images,
                    image_base64: images[0] ? images[0].image_base64 : null,
                    image_type: images[0] ? images[0].image_type : null
                };

                console.log('[Collect Payload] Item row:', {
                    index,
                    itemName,
                    itemQty,
                    imageCount: images.length
                });

                items.push(item);
            });
            payload.items_list = items;
            payload.items_text = items.map(i => `${i.quantity} יח' - ${i.name}`).join(' | ');
            payload.cartons = 'לא רלוונטי';
        } else { // דירה (גדולה)
            payload.cartons = formData.get('cartons');
            const cartonsValue = payload.cartons;
            
            // אם נבחר "מעביר פריטים בודדים", לטפל בזה כפריטים בודדים
            if (cartonsValue === 'מעביר פריטים בודדים') {
                payload.items_list = 'פריטים בודדים';
                payload.items_text = 'מעביר פריטים בודדים' + 
                    (payload.what_moving ? ' | פירוט: ' + payload.what_moving : '');
            } else {
                payload.items_list = 'דירה + ' + cartonsValue;
                payload.items_text = 'הובלת דירה - ' + cartonsValue +
                    (payload.what_moving ? ' | פירוט: ' + payload.what_moving : '');
            }

        }

        // הוספת שדות Drive תמיד (עם ערכים ריקים אם אין תיקייה)
        // הערכים יתעדכנו ב-form submit אם תיקייה נוצרה
        payload.drive_folder_url = '';
        payload.drive_folder_id = '';
        payload.drive_folder_name = '';
        payload.drive_files_count = 0;

        return payload;
    };

    /** שליחת הנתונים לוובהוק Make */
    const sendData = async (payload) => {
        // נוודא שהשדות תמיד קיימים (אם לא, נוסיף אותם עם ערכים ריקים)
        if (typeof payload.drive_folder_url === 'undefined') {
            payload.drive_folder_url = '';
        }
        if (typeof payload.drive_folder_id === 'undefined') {
            payload.drive_folder_id = '';
        }
        if (typeof payload.drive_folder_name === 'undefined') {
            payload.drive_folder_name = '';
        }
        if (typeof payload.drive_files_count === 'undefined') {
            payload.drive_files_count = 0;
        }
        
        // לוג לפני שליחה ל-Make
        console.log('[Send Data] Sending to Make webhook:', {
            has_drive_folder_url: !!payload.drive_folder_url,
            drive_folder_url: payload.drive_folder_url,
            drive_folder_id: payload.drive_folder_id,
            drive_folder_name: payload.drive_folder_name,
            drive_files_count: payload.drive_files_count
        });
        
        // לוג של כל ה-payload כדי לוודא שהשדות קיימים
        console.log('[Send Data] Full payload keys:', Object.keys(payload));
        console.log('[Send Data] Drive fields in payload:', {
            drive_folder_url: payload.drive_folder_url,
            drive_folder_id: payload.drive_folder_id,
            drive_folder_name: payload.drive_folder_name,
            drive_files_count: payload.drive_files_count
        });

        const itemsListForWebhook = Array.isArray(payload.items_list)
            ? payload.items_list.map((it) => ({
                name: it.name,
                quantity: it.quantity,
                image_count: Array.isArray(it.images)
                    ? it.images.length
                    : (it.image_base64 ? 1 : 0)
            }))
            : payload.items_list;

        const payloadForWebhook = { ...payload, items_list: itemsListForWebhook };
        
        try {
            const response = await fetch('https://hook.us1.make.com/wgko3er3c8r5mz8vv9llqwjza49jedfm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadForWebhook)
            });
            
            if (response.ok) {
                console.log('[Send Data] Successfully sent to Make webhook');
            } else {
                console.error('[Send Data] Failed to send to Make webhook, status:', response.status);
            }
        } catch (e) {
            console.error("שגיאה בשליחה ל-Make:", e);
        }
    };
    
    function getCookie(name) {
      const m = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
      return m ? m.pop() : '';
    }

    function setField(form, name, value) {
      const input = form.querySelector(`input[name="${name}"]`);
      if (input && value) input.value = value;
    }

    /** טיפול בשליחת הטופס */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

          if (!validateStep(currentStep)) return;

          // =========================
          // 🔹 PREPARE META DATA
          // =========================
          const eventId = crypto.randomUUID
          ? crypto.randomUUID()
          : 'eid-' + Date.now() + '-' + Math.random().toString(16).slice(2);
          setField(form, 'event_id', eventId);
          sessionStorage.setItem('liftygo_event_id', eventId);
          document.cookie = 'liftygo_event_id=' + encodeURIComponent(eventId) + '; path=/; max-age=7200';

          const fbp = getCookie('_fbp');
          const fbc = getCookie('_fbc');

          setField(form, 'fbp', fbp);
          setField(form, 'fbc', fbc);

        ['utm_source','utm_medium','utm_campaign','utm_content','fbclid']
            .forEach(k => setField(form, k, sessionStorage.getItem(k)));

          console.log('[LIFTYGO] submit prepared', { eventId, fbp, fbc });
        
        loaderTitle.textContent = 'התחלנו להזיז לך את ההובלה!';
        loaderSubtitle.textContent = 'מעלים תמונות לגוגל דרייב...';
        loader.classList.remove('quick-load'); 
        loader.classList.add('show');
        document.getElementById('mmwSubmit').classList.add('mmw-disabled');

        const payload = collectPayload();
        
        // העלאת תמונות לגוגל דרייב לפני שליחת הטופס
        const isSmallMove = (payload.move_type === 'הובלה קטנה');
        let driveFolderInfo = null;
        
        if (isSmallMove && payload.items_list && Array.isArray(payload.items_list)) {
            console.log('[Form Submit] Items list:', payload.items_list);
            
            const filesToUpload = [];
            
            payload.items_list.forEach((item, itemIndex) => {
                const base = safeDriveBaseName(item.name);
                const imgs = Array.isArray(item.images) && item.images.length
                    ? item.images
                    : (item.image_base64 && item.image_type
                        ? [{ image_base64: item.image_base64, image_type: item.image_type }]
                        : []);

                imgs.forEach((im, imgIdx) => {
                    const b64 = im.image_base64;
                    const mime = im.image_type;
                    if (!b64 || b64 === 'אין תמונה/סרטון' || !mime || !mime.startsWith('image/')) return;

                    const filename = `${base}_${imgIdx + 1}.jpg`;

                    console.log('[Form Submit] Adding file to upload:', {
                        filename,
                        mime_type: mime,
                        base64_length: b64.length,
                        itemIndex,
                        imgIdx
                    });

                    filesToUpload.push({
                        base64: b64,
                        filename,
                        mime_type: mime
                    });
                });

                if (!imgs.length) {
                    console.warn('[Form Submit] Item has no images:', { itemIndex, name: item.name });
                }
            });
            
            console.log('[Form Submit] Files to upload:', filesToUpload.length);
            console.log('[Form Submit] Files details:', filesToUpload.map(f => ({
                filename: f.filename,
                mime_type: f.mime_type,
                base64_length: f.base64 ? f.base64.length : 0,
                base64_preview: f.base64 ? f.base64.substring(0, 50) + '...' : 'empty'
            })));
            
            // דיבוג - בדיקה למה אין קבצים
            if (filesToUpload.length === 0) {
                console.warn('[Form Submit] ⚠️⚠️⚠️ NO FILES TO UPLOAD!');
                console.warn('[Form Submit] Items list length:', payload.items_list ? payload.items_list.length : 0);
                console.warn('[Form Submit] Items with images:', payload.items_list ? payload.items_list.filter(item =>
                    (item.images && item.images.length) || item.image_base64).length : 0);
                console.warn('[Form Submit] All items:', payload.items_list);
            }
            
            // יוצר תיקייה רק אם יש קבצים להעלאה
            if (filesToUpload.length > 0) {
                loaderSubtitle.textContent = `יוצר תיקייה ומעלה ${filesToUpload.length} קבצים...`;
                
                // המרת תאריך לפורמט YYYY-MM-DD (input type="date" מחזיר כבר בפורמט הזה)
                const orderDate = payload.date || new Date().toISOString().split('T')[0];
                
                console.log('[Form Submit] ⚠️⚠️⚠️ CALLING createFolderAndUploadToDrive');
                console.log('[Form Submit] Calling createFolderAndUploadToDrive:', {
                    customerName: payload.name || 'לקוח',
                    orderDate: orderDate,
                    filesCount: filesToUpload.length,
                    files: filesToUpload.map(f => ({
                        filename: f.filename,
                        mime_type: f.mime_type,
                        hasBase64: !!f.base64,
                        base64Length: f.base64 ? f.base64.length : 0
                    }))
                });
                
                try {
                    console.log('[Form Submit] ⚠️⚠️⚠️ CALLING createFolderAndUploadToDrive - START');
                    driveFolderInfo = await createFolderAndUploadToDrive(
                        payload.name || 'לקוח',
                        orderDate,
                        filesToUpload
                    );
                    console.log('[Form Submit] ⚠️⚠️⚠️ createFolderAndUploadToDrive RETURNED - SUCCESS');
                } catch (error) {
                    console.error('[Form Submit] ❌❌❌ ERROR in createFolderAndUploadToDrive:', error);
                    console.error('[Form Submit] Error type:', error.constructor.name);
                    console.error('[Form Submit] Error name:', error.name);
                    console.error('[Form Submit] Error message:', error.message);
                    console.error('[Form Submit] Error stack:', error.stack);
                    driveFolderInfo = null;
                }
                
                console.log('[Form Submit] Drive folder info received:', driveFolderInfo);
                console.log('[Form Submit] Drive folder info type:', typeof driveFolderInfo);
                console.log('[Form Submit] Drive folder info keys:', driveFolderInfo ? Object.keys(driveFolderInfo) : 'null');
                console.log('[Form Submit] Drive folder info full:', JSON.stringify(driveFolderInfo, null, 2));
                
                // נוודא שיש folder_id - זה הכי חשוב!
                if (driveFolderInfo && driveFolderInfo.folder_id) {
                    // אם יש folder_id, נבנה את folder_url אם חסר
                    if (!driveFolderInfo.folder_url) {
                        driveFolderInfo.folder_url = 'https://drive.google.com/drive/folders/' + driveFolderInfo.folder_id;
                        console.log('[Form Submit] ✅ Constructed folder_url from folder_id:', driveFolderInfo.folder_url);
                    }
                    
                    loaderSubtitle.textContent = 'תיקייה נוצרה בהצלחה! שולחים את פרטי ההזמנה...';
                    console.log('[Form Submit] ✅ Drive folder created successfully:', {
                        folder_url: driveFolderInfo.folder_url,
                        folder_id: driveFolderInfo.folder_id,
                        folder_name: driveFolderInfo.folder_name,
                        files_count: driveFolderInfo.files_count || 0
                    });
                    if (driveFolderInfo.upload_success === false && driveFolderInfo.upload_error) {
                        console.warn('[Form Submit] ⚠️ Image upload to Drive failed:', driveFolderInfo.upload_error.message || driveFolderInfo.upload_error);
                        console.warn('[Form Submit] upload_error details:', driveFolderInfo.upload_error);
                    }
                } else {
                    loaderSubtitle.textContent = 'שולחים את פרטי ההזמנה...';
                    console.error('[Form Submit] ❌ Failed to create drive folder or missing folder_id!');
                    console.error('[Form Submit] driveFolderInfo:', driveFolderInfo);
                    console.error('[Form Submit] driveFolderInfo type:', typeof driveFolderInfo);
                    if (driveFolderInfo) {
                        console.error('[Form Submit] driveFolderInfo keys:', Object.keys(driveFolderInfo));
                        console.error('[Form Submit] driveFolderInfo.folder_id:', driveFolderInfo.folder_id);
                    }
                }
            } else {
                console.log('[Form Submit] No files to upload, skipping folder creation');
                loaderSubtitle.textContent = 'שולחים את פרטי ההזמנה...';
            }
        }
        
        // עדכון מידע התיקייה ב-payload (השדות כבר קיימים עם ערכים ריקים מ-collectPayload)
        // זה הקוד הקריטי - כאן הקישור צריך להתעדכן!
        console.log('[Form Submit] Before updating payload - driveFolderInfo:', driveFolderInfo);
        console.log('[Form Submit] Before updating payload - has folder_id:', driveFolderInfo && driveFolderInfo.folder_id);
        
        if (driveFolderInfo && driveFolderInfo.folder_id) {
            // אם יש folder_id, נבנה את folder_url אם חסר
            const folderUrl = driveFolderInfo.folder_url || 
                             'https://drive.google.com/drive/folders/' + driveFolderInfo.folder_id;
            
            payload.drive_folder_url = folderUrl;
            payload.drive_folder_id = driveFolderInfo.folder_id;
            payload.drive_folder_name = driveFolderInfo.folder_name || '';
            payload.drive_files_count = driveFolderInfo.files_count || 0;
            
            console.log('[Form Submit] ✅✅✅ UPDATED drive folder info in payload:', {
                drive_folder_url: payload.drive_folder_url,
                drive_folder_id: payload.drive_folder_id,
                drive_folder_name: payload.drive_folder_name,
                drive_files_count: payload.drive_files_count
            });
        } else {
            // השדות כבר קיימים עם ערכים ריקים מ-collectPayload
            console.warn('[Form Submit] ⚠️⚠️⚠️ No drive folder info to update - keeping empty values:', {
                drive_folder_url: payload.drive_folder_url,
                drive_folder_id: payload.drive_folder_id,
                drive_folder_name: payload.drive_folder_name,
                drive_files_count: payload.drive_files_count,
                driveFolderInfo: driveFolderInfo
            });
        }
        
        console.log('[Form Submit] Final payload:', payload);
        
        loaderSubtitle.textContent = 'שולחים את פרטי ההזמנה שלך למובילים מומלצים.';
        await sendData(payload);

        await new Promise(resolve => setTimeout(resolve, 3000)); 

        const eid = payload.event_id || sessionStorage.getItem('liftygo_event_id') || '';
        const tnxUrl = 'https://liftygo.co.il/tnx' + (eid ? '/?event_id=' + encodeURIComponent(eid) : '');
        window.location.href = tnxUrl;
    });

    // ודא שהלוגיקה הדינמית פועלת גם בטעינת הדף (כאשר אין בחירה ראשונית)
    const step2 = document.querySelector('[data-step="2"]');
    const step3 = document.querySelector('[data-step="3"]');
    if (step2) toggleAccessFields(step2);
    if (step3) toggleAccessFields(step3);
// 🔁 תיקון חזרה אחורה בדפדפן (BFCache)
window.addEventListener('pageshow', () => {
  // סנכרון move_type
  const selectedMove = document.querySelector('input[name="move_type"]:checked');
  if (selectedMove) {
    moveType = selectedMove.value;
    updateChipState(selectedMove);
    toggleContentStep(moveType);
  }

  // סנכרון כל הצ'יפים המסומנים
  document.querySelectorAll('.mmw-chip input:checked').forEach(input => {
    updateChipState(input);
  });

  // סנכרון שלבים 2–3 (איסוף ויעד)
  const step2 = document.querySelector('[data-step="2"]');
  const step3 = document.querySelector('[data-step="3"]');
  if (step2) toggleAccessFields(step2);
  if (step3) toggleAccessFields(step3);

  updateProgress();
});

// === Google Places (NEW API - OFFICIAL) ===
(async () => {
  const { Autocomplete } = await google.maps.importLibrary("places");

  const pickupInput = document.querySelector('input[name="pickup"]');
  const dropoffInput = document.querySelector('input[name="dropoff"]');

  if (!pickupInput || !dropoffInput) return;

  const options = {
    componentRestrictions: { country: "il" },
    fields: ["formatted_address", "address_components", "geometry"],
    types: ["geocode"]
  };

  pickupAutocomplete = new Autocomplete(pickupInput, options);
  dropoffAutocomplete = new Autocomplete(dropoffInput, options);

pickupAutocomplete.addListener("place_changed", () => {
  const place = pickupAutocomplete.getPlace();

  if (!place || !place.geometry) {
    pickupPlace = null;
    // אם יש pending navigation אבל הבחירה נכשלה, נבטל אותו
    if (pendingNavigation && pendingNavigation.step === 2) {
      pendingNavigation = null;
    }
    return;
  }

  pickupPlace = place;
  pickupInput.value = place.formatted_address;
  // ניקוי ה-custom validity כדי שההודעה תיעלם
  pickupInput.setCustomValidity('');
  
  // אם יש pending navigation לשלב 2, נבצע אותו עכשיו
  if (pendingNavigation && pendingNavigation.step === 2) {
    // הערך כבר עודכן, אז נדלג על בדיקת הכתובת בולידציה
    const nav = pendingNavigation;
    pendingNavigation = null; // נבטל את ה-pending לפני הולידציה כדי למנוע race condition
    
    // משתמשים ב-requestAnimationFrame כדי לוודא שהערך עודכן ב-DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (validateStep(2, true)) { // skipPlaceCheck = true כי הערך כבר עודכן
            navigate(1);
          }
        }, 50); // delay קצר כדי לוודא שהערך עודכן ב-DOM
      });
    });
  }
});

dropoffAutocomplete.addListener("place_changed", () => {
  const place = dropoffAutocomplete.getPlace();

  if (!place || !place.geometry) {
    dropoffPlace = null;
    // אם יש pending navigation אבל הבחירה נכשלה, נבטל אותו
    if (pendingNavigation && pendingNavigation.step === 3) {
      pendingNavigation = null;
    }
    return;
  }

  dropoffPlace = place;
  dropoffInput.value = place.formatted_address;
  // ניקוי ה-custom validity כדי שההודעה תיעלם
  dropoffInput.setCustomValidity('');
  
  // אם יש pending navigation לשלב 3, נבצע אותו עכשיו
  if (pendingNavigation && pendingNavigation.step === 3) {
    // הערך כבר עודכן, אז נדלג על בדיקת הכתובת בולידציה
    const nav = pendingNavigation;
    pendingNavigation = null; // נבטל את ה-pending לפני הולידציה כדי למנוע race condition
    
    // משתמשים ב-requestAnimationFrame כדי לוודא שהערך עודכן ב-DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (validateStep(3, true)) { // skipPlaceCheck = true כי הערך כבר עודכן
            navigate(1);
          }
        }, 50); // delay קצר כדי לוודא שהערך עודכן ב-DOM
      });
    });
  }
});


pickupInput.addEventListener('input', () => {
  // אם יש pickupPlace, נבדוק אם הערך השתנה מהערך שנבחר
  if (pickupPlace && pickupPlace.formatted_address) {
    if (pickupInput.value.trim() !== pickupPlace.formatted_address.trim()) {
      // הערך השתנה - נאפס את pickupPlace כדי לחייב בחירה מחדש
      pickupPlace = null;
    }
  } else {
    // אין pickupPlace, נאפס אותו בכל מקרה
    pickupPlace = null;
  }
  // ניקוי ה-custom validity כשהמשתמש מתחיל להקליד
  pickupInput.setCustomValidity('');
});

dropoffInput.addEventListener('input', () => {
  // אם יש dropoffPlace, נבדוק אם הערך השתנה מהערך שנבחר
  if (dropoffPlace && dropoffPlace.formatted_address) {
    if (dropoffInput.value.trim() !== dropoffPlace.formatted_address.trim()) {
      // הערך השתנה - נאפס את dropoffPlace כדי לחייב בחירה מחדש
      dropoffPlace = null;
    }
  } else {
    // אין dropoffPlace, נאפס אותו בכל מקרה
    dropoffPlace = null;
  }
  // ניקוי ה-custom validity כשהמשתמש מתחיל להקליד
  dropoffInput.setCustomValidity('');
});


})();


    updateProgress();
});