         
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
    const book = document.getElementById('book');
    const skipMoveTypeStep = book?.classList.contains('mmw-order--apartment-only');
    const firstNavigableStep = skipMoveTypeStep ? 2 : 1;
    const steps = document.querySelectorAll('.mmw-step');
    const progressBar = document.getElementById('mmwBar');
    const loader = document.getElementById('mmwLoader');
    const loaderTitle = document.getElementById('loaderTitle');
    const loaderSubtitle = document.getElementById('loaderSubtitle');
    const itemsContainer = document.getElementById('mmwItems');
    const addItemBtn = document.getElementById('mmwAddItem');
    const cartonsSelectElement = document.querySelector('select[name="cartons"]');
    const apartmentRoomsWrap = document.querySelector('[data-rooms-wrap]');
    const apartmentRoomsInput = document.querySelector('input[name="apartment_rooms"]');
    const SIGNED_UPLOAD_URL_ENDPOINT = 'https://gcs-signed-url-service-163624355434.me-west1.run.app/create-upload-url';
    const MAX_MEDIA_FILES = 5;
    const MAX_MEDIA_FILE_SIZE_MB = 10;
    const MAX_MEDIA_FILE_SIZE_BYTES = MAX_MEDIA_FILE_SIZE_MB * 1024 * 1024;

    const apartmentMediaInput = document.getElementById('mmwApartmentMediaInput');
    const apartmentMediaBtn = document.getElementById('mmwApartmentMediaBtn');
    const apartmentMediaList = document.getElementById('mmwApartmentMediaList');
    const apartmentMediaClear = document.getElementById('mmwApartmentMediaClear');
    const mediaPromptModal = document.getElementById('mmwMediaPromptModal');
    const mediaPromptAddBtn = document.getElementById('mmwMediaPromptAdd');
    const mediaPromptSkipBtn = document.getElementById('mmwMediaPromptSkip');
    const mediaPromptCloseBtn = document.getElementById('mmwMediaPromptClose');
    /** קבצי מדיה לשלב הובלת דירה (עד 5, כמו survey.html) */
    let apartmentMediaFiles = [];
    let allowSubmitWithoutMedia = false;

    let currentStep = firstNavigableStep;
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

    const estimateRoomsByCartons = (cartonsValue) => {
        switch (cartonsValue) {
            case '1 - 20 קרטונים':
                return '1';
            case '20 - 50 קרטונים':
                return '2';
            case '50 - 100 קרטונים':
                return '3';
            case '100 - 150 קרטונים':
                return '4';
            case '150 - 200 קרטונים':
                return '5';
            case '200+ קרטונים':
                return '';
            default:
                return '';
        }
    };

    const resetApartmentRooms = () => {
        if (!apartmentRoomsInput) return;
        apartmentRoomsInput.value = '';
        apartmentRoomsInput.dataset.autoFilled = '0';
        apartmentRoomsInput.removeAttribute('required');
        apartmentRoomsInput.setCustomValidity('');
    };

    const syncApartmentRoomsField = () => {
        if (!apartmentRoomsWrap || !apartmentRoomsInput) return;
        const selectedMoveTypeInput = document.querySelector('input[name="move_type"]:checked');
        const selectedMoveType = selectedMoveTypeInput ? selectedMoveTypeInput.value : '';
        const cartonsValue = cartonsSelectElement ? cartonsSelectElement.value : '';
        const shouldShow =
            selectedMoveType === 'הובלת דירה' &&
            cartonsValue &&
            cartonsValue !== 'מעביר פריטים בודדים';

        apartmentRoomsWrap.classList.toggle('is-open', !!shouldShow);

        if (!shouldShow) {
            resetApartmentRooms();
            return;
        }

        const suggestedRooms = estimateRoomsByCartons(cartonsValue);
        if (!apartmentRoomsInput.value || apartmentRoomsInput.dataset.autoFilled === '1') {
            apartmentRoomsInput.value = suggestedRooms;
            apartmentRoomsInput.dataset.autoFilled = suggestedRooms ? '1' : '0';
        }
    };

    if (apartmentRoomsInput) {
        apartmentRoomsInput.addEventListener('input', () => {
            apartmentRoomsInput.dataset.autoFilled = '0';
        });
    }
    if (cartonsSelectElement) {
        cartonsSelectElement.addEventListener('change', syncApartmentRoomsField);
    }

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

    const syncPropertyAccessScopes = () => {
        document.querySelectorAll('[data-mmw-access-scope]').forEach((scope) => toggleAccessFields(scope));
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

            if (radio && currentStep === 1 && !skipMoveTypeStep) {
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

        if (nextStep < firstNavigableStep || nextStep > totalSteps) return;

        steps[currentStep - 1].classList.remove('active');
        currentStep = nextStep;
        steps[currentStep - 1].classList.add('active');
        // אם חזרנו לשלב 1 – מנקה בחירה (לא במצב דירה בלבד)
        if (currentStep === 1 && !skipMoveTypeStep) {
            document.querySelectorAll('input[name="move_type"]').forEach(r => {
                r.checked = false;
            });
            document.querySelectorAll('[data-group="move_type"] .mmw-chip')
                .forEach(c => c.classList.remove('active'));

            moveType = null;
        }

        // שלב 3: סוג נכס / קומה / נגישות — לכל צד בנפרד
        if (currentStep === 3) {
            syncPropertyAccessScopes();
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

    const openMediaPrompt = () => {
        if (!mediaPromptModal) return;
        mediaPromptModal.classList.add('open');
        mediaPromptModal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    const closeMediaPrompt = () => {
        if (!mediaPromptModal) return;
        mediaPromptModal.classList.remove('open');
        mediaPromptModal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    /** עדכון סרגל ההתקדמות */
    const updateProgress = () => {
        let percent;
        if (skipMoveTypeStep) {
            const span = totalSteps - firstNavigableStep;
            percent = span > 0 ? ((currentStep - firstNavigableStep) / span) * 100 : 0;
        } else {
            percent = (currentStep - 1) / (totalSteps - 1) * 100;
        }
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
            if (cartonsSelect) cartonsSelect.value = '';
            resetApartmentRooms();
            if (apartmentRoomsWrap) apartmentRoomsWrap.classList.remove('is-open');
            if (firstItemInput) firstItemInput.setAttribute('required', true);
            apartmentMediaFiles = [];
            renderApartmentMediaList();
        } else {
            cartonsSelect.setAttribute('required', true);
            step.querySelectorAll('.small-move input[name^="item_name_"]').forEach(input => input.removeAttribute('required'));
            syncApartmentRoomsField();
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
    
    /** בדיקת כתובת איסוף מול Google Places */
    const validateGooglePickupAddress = () => {
        const pickupInput = document.querySelector('input[name="pickup"]');

        if (pickupPlace && pickupPlace.formatted_address && pickupInput && pickupInput.value.trim()) {
            if (pickupInput.value.trim() !== pickupPlace.formatted_address.trim()) {
                pickupPlace = null;
                pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
                pickupInput.reportValidity();
                return false;
            }
        }

        if (!pickupPlace && pickupInput && pickupInput.value.trim()) {
            if (pickupAutocomplete) {
                try {
                    const place = pickupAutocomplete.getPlace();
                    if (place && place.geometry) {
                        pickupPlace = place;
                    } else {
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
                        return false;
                    }
                } catch (e) {
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
                    return false;
                }
            } else {
                if (!pickupInput.value.trim()) {
                    pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
                    pickupInput.reportValidity();
                    return false;
                }
            }
        } else if (!pickupPlace) {
            const pacContainer = document.querySelector('.pac-container');
            const isPacVisible = pacContainer && pacContainer.style.display !== 'none' &&
                pacContainer.children.length > 0;
            if (!isPacVisible) {
                if (pickupInput) {
                    pickupInput.setCustomValidity('אנא בחר כתובת איסוף מתוך ההצעות של גוגל');
                    pickupInput.reportValidity();
                }
            }
            return false;
        }

        return true;
    };

    /** בדיקת כתובת יעד מול Google Places */
    const validateGoogleDropoffAddress = () => {
        const dropoffInput = document.querySelector('input[name="dropoff"]');

        if (dropoffPlace && dropoffPlace.formatted_address && dropoffInput && dropoffInput.value.trim()) {
            if (dropoffInput.value.trim() !== dropoffPlace.formatted_address.trim()) {
                dropoffPlace = null;
                dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
                dropoffInput.reportValidity();
                return false;
            }
        }

        if (!dropoffPlace && dropoffInput && dropoffInput.value.trim()) {
            if (dropoffAutocomplete) {
                try {
                    const place = dropoffAutocomplete.getPlace();
                    if (place && place.geometry) {
                        dropoffPlace = place;
                    } else {
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
                        return false;
                    }
                } catch (e) {
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
                    return false;
                }
            } else {
                if (!dropoffInput.value.trim()) {
                    dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
                    dropoffInput.reportValidity();
                    return false;
                }
            }
        } else if (!dropoffPlace) {
            const pacContainer = document.querySelector('.pac-container');
            const isPacVisible = pacContainer && pacContainer.style.display !== 'none' &&
                pacContainer.children.length > 0;
            if (!isPacVisible) {
                if (dropoffInput) {
                    dropoffInput.setCustomValidity('אנא בחר כתובת יעד מתוך ההצעות של גוגל');
                    dropoffInput.reportValidity();
                }
            }
            return false;
        }

        return true;
    };

    /** ולידציה של השלב הנוכחי — placeOpts: true (דילוג על שתי הכתובות), או { skipPickupPlace, skipDropoffPlace } */
    const validateStep = (step, placeOpts) => {
        if (skipMoveTypeStep && step === 1) return true;

        let skipPickupPlace = false;
        let skipDropoffPlace = false;
        if (placeOpts === true) {
            skipPickupPlace = true;
            skipDropoffPlace = true;
        } else if (placeOpts && typeof placeOpts === 'object') {
            skipPickupPlace = !!placeOpts.skipPickupPlace;
            skipDropoffPlace = !!placeOpts.skipDropoffPlace;
        }

        const currentStepElement = steps[step - 1];
        let isValid = true;

        const hasPendingNav = pendingNavigation && pendingNavigation.step === step;
        const skipAllGooglePlaces = hasPendingNav || placeOpts === true;
        
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

        // כתובות Google — בשלב 2 יחד (איסוף + יעד)
        if (!skipAllGooglePlaces && step === 2) {
            if (!skipPickupPlace && !validateGooglePickupAddress()) return false;
            if (!skipDropoffPlace && !validateGoogleDropoffAddress()) return false;
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
                const scope = e.target.closest('[data-mmw-access-scope]');
                if (scope) toggleAccessFields(scope);
                else toggleAccessFields(e.target.closest('.mmw-step'));
            }
            // *** סוף לוגיקה דינמית ***

            if (e.target.name === 'move_type') {
                moveType = e.target.value;
                toggleContentStep(moveType);
            }
            if (e.target.name === 'move_type' || e.target.name === 'cartons') {
                syncApartmentRoomsField();
            }
            
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
                    <input type="file" accept="image/*,video/*" class="mmw-img-input" style="display:none" data-index="${index}" />
                    <button type="button" class="img-btn" title="הוספת תמונה או סרטון">
                📸    </button>
                    <img class="preview" alt="תצוגה מקדימה" style="display:none;" />
                    <video class="preview-video" alt="תצוגה מקדימה" style="display:none;" controls></video>
                </div>
                <button type="button" class="del" title="מחיקת פריט">✖</button>
            `;

            row.querySelector('.del').addEventListener('click', () => {
                 row.remove();
                 const firstItem = itemsContainer.querySelector('.row [name^="item_name_"]');
                 if (firstItem) firstItem.setAttribute('required', true);
            });

            const imgBtn = row.querySelector('.img-btn');
            const fileInput = row.querySelector('.mmw-img-input');
            const previewImg = row.querySelector('.preview');
            const previewVideo = row.querySelector('.preview-video');

            imgBtn.addEventListener('click', () => fileInput.click());
            
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/');
                    if (!isMedia) {
                        alert('אפשר להעלות רק תמונה או סרטון.');
                        e.target.value = '';
                        return;
                    }
                    if (file.size > MAX_MEDIA_FILE_SIZE_BYTES) {
                        alert(`הקובץ גדול מדי. אפשר עד ${MAX_MEDIA_FILE_SIZE_MB}MB לקובץ.`);
                        e.target.value = '';
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const isVideo = file.type.startsWith('video/');
                        if (isVideo) {
                            previewVideo.src = e.target.result;
                            previewVideo.style.display = 'block';
                            previewImg.style.display = 'none';
                        } else {
                            previewImg.src = e.target.result;
                            previewImg.style.display = 'block';
                            previewVideo.style.display = 'none';
                        }
                        imgBtn.style.display = 'none';
                    };
                    reader.readAsDataURL(file);
                }
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

        // תמיכה גם בתמונות וגם בסרטונים
        const match = dataUrl.match(/^data:(image\/\w+|video\/\w+);base64,(.+)$/);

        if (!match) {
            console.warn('[Extract Base64] No match found for data URL pattern');
            console.warn('[Extract Base64] Data URL preview:', dataUrl.substring(0, 100));
            return { base64: null, type: null };
        }

        const result = {
            base64: match[2],   // Base64 נקי
            type: match[1]      // image/jpeg | image/png | video/mp4 וכו'
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
     * יצירת תיקייה והעלאת תמונות/סרטונים לגוגל דרייב
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
        
        // ⚠️ זמני: לא מעלים תמונות לדרייב (חוסך זמן + יש תקלה). התיקייה תיווצר כרגיל, הקבצים לא נשלחים.
        const SKIP_FILE_UPLOAD_TEMP = true;
        const filesToSend = SKIP_FILE_UPLOAD_TEMP ? [] : validFiles;
        if (SKIP_FILE_UPLOAD_TEMP) {
            console.log('[Drive Upload] (זמני) דילוג על העלאת קבצים – רק יצירת תיקייה');
        }
        
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

    const renderApartmentMediaList = () => {
        if (!apartmentMediaList) return;
        apartmentMediaList.innerHTML = '';
        apartmentMediaFiles.forEach((file, idx) => {
            const li = document.createElement('li');
            li.className = 'mmw-apartment-media-item';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'mmw-apartment-media-name';
            nameSpan.textContent = file.name;
            const metaSpan = document.createElement('span');
            metaSpan.className = 'mmw-apartment-media-meta';
            metaSpan.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
            const rm = document.createElement('button');
            rm.type = 'button';
            rm.className = 'mmw-apartment-media-remove';
            rm.setAttribute('aria-label', 'הסר קובץ');
            rm.textContent = '×';
            rm.addEventListener('click', () => {
                apartmentMediaFiles.splice(idx, 1);
                renderApartmentMediaList();
            });
            li.append(nameSpan, metaSpan, rm);
            apartmentMediaList.appendChild(li);
        });
        apartmentMediaList.hidden = apartmentMediaFiles.length === 0;
        if (apartmentMediaClear) {
            apartmentMediaClear.style.display = apartmentMediaFiles.length ? 'block' : 'none';
        }
    };

    if (apartmentMediaBtn && apartmentMediaInput) {
        apartmentMediaBtn.addEventListener('click', () => apartmentMediaInput.click());
    }
    if (apartmentMediaInput) {
        apartmentMediaInput.addEventListener('change', (e) => {
            const picked = Array.from(e.target.files || []);
            e.target.value = '';
            if (picked.length === 0) return;

            const invalid = picked.find((f) => !f.type.startsWith('image/') && !f.type.startsWith('video/'));
            if (invalid) {
                alert(`הקובץ "${invalid.name}" אינו תמונה/סרטון תקין.`);
                return;
            }
            const oversized = picked.find((f) => f.size > MAX_MEDIA_FILE_SIZE_BYTES);
            if (oversized) {
                alert(`הקובץ "${oversized.name}" גדול מדי. אפשר עד ${MAX_MEDIA_FILE_SIZE_MB}MB לכל קובץ.`);
                return;
            }

            const merged = apartmentMediaFiles.concat(picked);
            if (merged.length > MAX_MEDIA_FILES) {
                alert(`אפשר עד ${MAX_MEDIA_FILES} קבצים בסך הכול (כולל מדיה לפריטים בהובלה קטנה בשליחה).`);
                apartmentMediaFiles = merged.slice(0, MAX_MEDIA_FILES);
            } else {
                apartmentMediaFiles = merged;
            }
            renderApartmentMediaList();
            if (apartmentMediaFiles.length > 0) allowSubmitWithoutMedia = false;
        });
    }
    if (apartmentMediaClear) {
        apartmentMediaClear.addEventListener('click', () => {
            apartmentMediaFiles = [];
            renderApartmentMediaList();
        });
    }

    if (mediaPromptCloseBtn) {
        mediaPromptCloseBtn.addEventListener('click', closeMediaPrompt);
    }
    if (mediaPromptModal) {
        mediaPromptModal.addEventListener('click', (e) => {
            if (e.target === mediaPromptModal) closeMediaPrompt();
        });
    }
    if (mediaPromptAddBtn) {
        mediaPromptAddBtn.addEventListener('click', () => {
            allowSubmitWithoutMedia = false;
            closeMediaPrompt();
            if (currentStep === 5) {
                navigate(-1);
            }
            document.querySelector('.mmw-apartment-media, #mmwItems')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }
    if (mediaPromptSkipBtn) {
        mediaPromptSkipBtn.addEventListener('click', () => {
            allowSubmitWithoutMedia = true;
            closeMediaPrompt();
            form.requestSubmit();
        });
    }

    const collectApartmentMediaFiles = () =>
        apartmentMediaFiles.map((file) => ({
            file,
            index: -1,
            itemName: null
        }));

    const collectMediaFilesFromRows = () => {
        const mediaFiles = [];
        document.querySelectorAll('.mmw-items .row').forEach((row, index) => {
            const fileInput = row.querySelector('.mmw-img-input');
            const file = fileInput && fileInput.files ? fileInput.files[0] : null;
            if (!file) return;
            mediaFiles.push({
                file,
                index,
                itemName: row.querySelector(`[name="item_name_${index}"]`)?.value || ''
            });
        });
        return mediaFiles;
    };

    const uploadMediaFilesToGcs = async (mediaFiles) => {
        const uploadedItems = [];

        for (let i = 0; i < mediaFiles.length; i += 1) {
            const media = mediaFiles[i];
            const file = media.file;

            const signedUrlRes = await fetch(SIGNED_UPLOAD_URL_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type || 'application/octet-stream',
                    size: file.size
                })
            });

            if (!signedUrlRes.ok) {
                throw new Error('signed_url_request_failed');
            }

            const signedPayload = await signedUrlRes.json();
            const signedUrl = signedPayload?.signedUrl;
            if (!signedUrl) {
                throw new Error('signed_url_missing');
            }

            const uploadRes = await fetch(signedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file
            });
            if (!uploadRes.ok) {
                throw new Error('gcs_upload_failed');
            }

            uploadedItems.push({
                media_type: file.type.startsWith('image/') ? 'image' : 'video',
                media_url: signedPayload?.publicUrl || null,
                gcs_bucket: signedPayload?.bucket || null,
                gcs_object_key: signedPayload?.objectKey || null,
                file_name: file.name,
                file_size: file.size,
                file_type: file.type,
                item_name: media.itemName || null
            });
        }

        return uploadedItems;
    };

    /** איסוף הנתונים ל-Payload */
    const collectPayload = () => {
        const formData = new FormData(form);
        const payload = {};
        const items = [];

                payload.order_id = generateOrderId();

        payload.move_type = formData.get('move_type');
        payload.pickup = formData.get('pickup');
        payload.dropoff = formData.get('dropoff');
        payload.moving_timing = formData.get('moving_timing');
        payload.date = null;

        // מיפוי רמת דחיפות לפי בחירה ידנית של המשתמש
        if (payload.moving_timing === 'דחיפות מיידית - עד 48 שעות') {
            payload.is_urgent = 'דחוף';
        } else if (payload.moving_timing === 'לשבוע הקרוב') {
            payload.is_urgent = 'גבוה';
        } else if (payload.moving_timing === 'לחודש הקרוב') {
            payload.is_urgent = 'בינוני';
        } else if (payload.moving_timing === 'גמיש') {
            payload.is_urgent = 'גמיש';
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
        payload.apartment_rooms = formData.get('apartment_rooms') || '';

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
                const previewImg = row.querySelector('.preview');
                const previewVideo = row.querySelector('.preview-video');
                
                console.log('[Collect Payload] Checking row:', {
                    index,
                    itemName,
                    itemQty,
                    hasPreviewImg: !!previewImg,
                    hasPreviewVideo: !!previewVideo,
                    previewImgSrc: previewImg ? previewImg.src : 'none',
                    previewVideoSrc: previewVideo ? previewVideo.src : 'none',
                    previewImgDisplay: previewImg ? window.getComputedStyle(previewImg).display : 'none',
                    previewVideoDisplay: previewVideo ? window.getComputedStyle(previewVideo).display : 'none'
                });
                
                if (itemName && itemQty) {
                    // בדיקה אם זה תמונה או סרטון
                    let previewSrc = '';
                    
                    // בדיקה קודם כל אם יש video עם data URL (לא דורשים display - רק שיהיה src תקין)
                    if (previewVideo) {
                        try {
                            const videoSrc = previewVideo.src || previewVideo.getAttribute('src') || (previewVideo.currentSrc || '');
                            console.log('[Collect Payload] Video check:', {
                                src: videoSrc ? videoSrc.substring(0, 100) : 'none',
                                hasSrc: !!videoSrc,
                                startsWithData: videoSrc && typeof videoSrc === 'string' ? videoSrc.startsWith('data:') : false
                            });
                            if (videoSrc && typeof videoSrc === 'string' && videoSrc !== '' && videoSrc.startsWith('data:')) {
                                previewSrc = videoSrc;
                                console.log('[Collect Payload] ✅ Using video src (data URL found)');
                            }
                        } catch (e) {
                            console.warn('[Collect Payload] Error checking video:', e);
                        }
                    }
                    
                    // אם אין video, נבדוק תמונה
                    if (!previewSrc && previewImg) {
                        try {
                            const imgSrc = previewImg.src || previewImg.getAttribute('src') || (previewImg.currentSrc || '');
                            console.log('[Collect Payload] Image check:', {
                                src: imgSrc ? imgSrc.substring(0, 100) : 'none',
                                hasSrc: !!imgSrc,
                                startsWithData: imgSrc && typeof imgSrc === 'string' ? imgSrc.startsWith('data:') : false
                            });
                            if (imgSrc && typeof imgSrc === 'string' && imgSrc !== '' && imgSrc.startsWith('data:')) {
                                previewSrc = imgSrc;
                                console.log('[Collect Payload] ✅ Using image src (data URL found)');
                            }
                        } catch (e) {
                            console.warn('[Collect Payload] Error checking image:', e);
                        }
                    }
                    
                    // אם לא מצאנו previewSrc, ננסה לחפש בכל ה-row
                    if (!previewSrc) {
                        try {
                            const allImages = row.querySelectorAll('img.preview, video.preview-video');
                            console.log('[Collect Payload] Fallback search - found', allImages.length, 'media elements');
                            for (const media of allImages) {
                                const mediaSrc = media.src || media.getAttribute('src') || (media.currentSrc || '');
                                console.log('[Collect Payload] Checking media element:', {
                                    tagName: media.tagName,
                                    hasSrc: !!mediaSrc,
                                    srcLength: mediaSrc ? mediaSrc.length : 0,
                                    startsWithData: mediaSrc && typeof mediaSrc === 'string' ? mediaSrc.startsWith('data:') : false
                                });
                                if (mediaSrc && typeof mediaSrc === 'string' && mediaSrc.startsWith('data:')) {
                                    previewSrc = mediaSrc;
                                    console.log('[Collect Payload] ✅ Found media src in fallback search');
                                    break;
                                }
                            }
                        } catch (e) {
                            console.warn('[Collect Payload] Error in fallback search:', e);
                        }
                    }
                    
                    const fileData = extractBase64Image(previewSrc);
                    
                    console.log('[Collect Payload] Item result:', {
                        index,
                        itemName,
                        previewSrc: previewSrc ? previewSrc.substring(0, 50) + '...' : 'empty',
                        hasBase64: !!fileData.base64,
                        base64Length: fileData.base64 ? fileData.base64.length : 0,
                        fileType: fileData.type,
                        fileData: fileData
                    });
                    
                    const item = {
                        name: itemName,
                        quantity: itemQty,
                        has_media: !!(fileData.base64 && fileData.type),
                        image_type: fileData.type || null
                    };
                    
                    items.push(item);
                }
            });
            payload.items_list = items;
            payload.items_text = items.map(i => `${i.quantity} יח' - ${i.name}`).join(' | ');
            payload.cartons = 'לא רלוונטי';
            payload.apartment_rooms = '';
        } else { // דירה (גדולה)
            payload.cartons = formData.get('cartons');
            const cartonsValue = payload.cartons;
            const roomsValue = (payload.apartment_rooms || '').toString().trim();
            
            // אם נבחר "מעביר פריטים בודדים", לטפל בזה כפריטים בודדים
            if (cartonsValue === 'מעביר פריטים בודדים') {
                payload.apartment_rooms = '';
                payload.items_list = 'פריטים בודדים';
                payload.items_text = 'מעביר פריטים בודדים' + 
                    (payload.what_moving ? ' | פירוט: ' + payload.what_moving : '');
            } else {
                payload.items_list = 'דירה + ' + cartonsValue;
                payload.items_text =
                    'הובלת דירה - ' + cartonsValue +
                    (roomsValue ? ' | חדרים: ' + roomsValue : '') +
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

    /** שליחת הנתונים ל-Make ול-Responder */
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
        
        try {
            const response = await fetch('https://hook.us1.make.com/wgko3er3c8r5mz8vv9llqwjza49jedfm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log('[Send Data] Successfully sent to Make webhook');
            } else {
                console.error('[Send Data] Failed to send to Make webhook, status:', response.status);
            }
        } catch (e) {
            console.error("שגיאה בשליחה ל-Make:", e);
        }

        try {
            const r = new URLSearchParams();
            r.append('fname', payload.name);
            r.append('phone', payload.phone);
            r.append('custom_3', payload.items_text); 
            r.append('custom_4', payload.moving_timing || '');
            r.append('custom_5', payload.pickup + ' > ' + payload.dropoff); 
            r.append('form_id', '2810431');
            r.append('action', 'subscribe');
            r.append('list', '1'); 

            await fetch('https://subscribe.responder.co.il', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: r.toString(),
                mode: 'no-cors'
            });
        } catch (e) {
            console.error("שגיאה בשליחה ל-Responder:", e);
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

        const mediaFiles = collectApartmentMediaFiles().concat(collectMediaFilesFromRows());
        if (mediaFiles.length === 0 && !allowSubmitWithoutMedia) {
            openMediaPrompt();
            return;
        }
        if (mediaFiles.length > 0) {
            allowSubmitWithoutMedia = false;
        }

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
        loaderSubtitle.textContent = 'מעלה תמונות וסרטונים לאחסון מאובטח...';
        loader.classList.remove('quick-load'); 
        loader.classList.add('show');
        document.getElementById('mmwSubmit').classList.add('mmw-disabled');

        const payload = collectPayload();
        
        // העלאת קבצי מדיה ל-GCS דרך Signed URL, כמו ב-survey.html (דירה + פריטים בהובלה קטנה)
        if (mediaFiles.length > MAX_MEDIA_FILES) {
            alert(`אפשר להעלות עד ${MAX_MEDIA_FILES} קבצים בכל שליחה.`);
            loader.classList.remove('show');
            document.getElementById('mmwSubmit').classList.remove('mmw-disabled');
            return;
        }

        const oversizedFile = mediaFiles.find(media => media.file.size > MAX_MEDIA_FILE_SIZE_BYTES);
        if (oversizedFile) {
            alert(`הקובץ "${oversizedFile.file.name}" גדול מדי. אפשר עד ${MAX_MEDIA_FILE_SIZE_MB}MB לכל קובץ.`);
            loader.classList.remove('show');
            document.getElementById('mmwSubmit').classList.remove('mmw-disabled');
            return;
        }

        if (mediaFiles.length > 0) {
            if (!SIGNED_UPLOAD_URL_ENDPOINT) {
                alert('חסר חיבור לשרת העלאה מאובטח. יש להגדיר SIGNED_UPLOAD_URL_ENDPOINT.');
                loader.classList.remove('show');
                document.getElementById('mmwSubmit').classList.remove('mmw-disabled');
                return;
            }

            loaderSubtitle.textContent = `מעלה ${mediaFiles.length} קבצי מדיה...`;

            try {
                const mediaItems = await uploadMediaFilesToGcs(mediaFiles);
                payload.media_count = mediaItems.length;
                payload.media_items = mediaItems;

                // תאימות לאחור לשדות יחידים במידת הצורך
                payload.media_type = mediaItems[0]?.media_type || null;
                payload.media_url = mediaItems[0]?.media_url || null;
                payload.gcs_bucket = mediaItems[0]?.gcs_bucket || null;
                payload.gcs_object_key = mediaItems[0]?.gcs_object_key || null;
                payload.video_file_name = mediaItems[0]?.file_name || null;
                payload.video_file_size = mediaItems[0]?.file_size || null;
                payload.video_file_type = mediaItems[0]?.file_type || null;
            } catch (uploadError) {
                console.error('[Form Submit] Failed to upload media to GCS:', uploadError);
                alert(`העלאת המדיה נכשלה.\n\nנסה:\n• עד ${MAX_MEDIA_FILES} קבצים\n• עד ${MAX_MEDIA_FILE_SIZE_MB}MB לכל קובץ\n• חיבור אינטרנט יציב`);
                loader.classList.remove('show');
                document.getElementById('mmwSubmit').classList.remove('mmw-disabled');
                return;
            }
        } else {
            payload.media_count = 0;
            payload.media_items = [];
            payload.media_type = null;
            payload.media_url = null;
            payload.gcs_bucket = null;
            payload.gcs_object_key = null;
            payload.video_file_name = null;
            payload.video_file_size = null;
            payload.video_file_type = null;
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
    if (skipMoveTypeStep) {
        const aptRadio = document.querySelector('input[name="move_type"][value="הובלת דירה"]');
        if (aptRadio) {
            aptRadio.checked = true;
            updateChipState(aptRadio);
            moveType = 'הובלת דירה';
            toggleContentStep(moveType);
        }
        currentStep = Math.max(currentStep, firstNavigableStep);
        steps.forEach((el) => {
            const n = parseInt(el.getAttribute('data-step'), 10);
            el.classList.toggle('active', n === currentStep);
        });
    }
    syncPropertyAccessScopes();
    syncApartmentRoomsField();
// 🔁 תיקון חזרה אחורה בדפדפן (BFCache)
window.addEventListener('pageshow', () => {
  if (skipMoveTypeStep) {
    const aptRadio = document.querySelector('input[name="move_type"][value="הובלת דירה"]');
    if (aptRadio) {
      aptRadio.checked = true;
      moveType = 'הובלת דירה';
      updateChipState(aptRadio);
      toggleContentStep(moveType);
    }
    if (currentStep < firstNavigableStep) currentStep = firstNavigableStep;
    document.querySelectorAll('.mmw-step').forEach((el) => {
      const n = parseInt(el.getAttribute('data-step'), 10);
      el.classList.toggle('active', n === currentStep);
    });
  }
  // סנכרון move_type
  const selectedMove = document.querySelector('input[name="move_type"]:checked');
  if (selectedMove) {
    moveType = selectedMove.value;
    updateChipState(selectedMove);
    toggleContentStep(moveType);
  }
  syncApartmentRoomsField();

  // סנכרון כל הצ'יפים המסומנים
  document.querySelectorAll('.mmw-chip input:checked').forEach(input => {
    updateChipState(input);
  });

  syncPropertyAccessScopes();

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
  
  // אם יש pending navigation לשלב 2, נבצע אותו עכשיו (רק אם גם יעד תקין)
  if (pendingNavigation && pendingNavigation.step === 2) {
    pendingNavigation = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (validateStep(2, { skipPickupPlace: true })) {
            navigate(1);
          }
        }, 50);
      });
    });
  }
});

dropoffAutocomplete.addListener("place_changed", () => {
  const place = dropoffAutocomplete.getPlace();

  if (!place || !place.geometry) {
    dropoffPlace = null;
    // אם יש pending navigation אבל הבחירה נכשלה, נבטל אותו
    if (pendingNavigation && pendingNavigation.step === 2) {
      pendingNavigation = null;
    }
    return;
  }

  dropoffPlace = place;
  dropoffInput.value = place.formatted_address;
  // ניקוי ה-custom validity כדי שההודעה תיעלם
  dropoffInput.setCustomValidity('');
  
  if (pendingNavigation && pendingNavigation.step === 2) {
    pendingNavigation = null;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (validateStep(2, { skipDropoffPlace: true })) {
            navigate(1);
          }
        }, 50);
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
