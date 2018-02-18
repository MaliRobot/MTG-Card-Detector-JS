
const IM_WIDTH = 800;
const IM_HEIGHT = 600; 

const BKG_THRESH = 60;

const RANK_DIFF_MAX = 200000;

const CARD_MAX_AREA = 300000;
const CARD_MIN_AREA = 60000;

class QueryCard {
	// Structure to store information about query cards in the camera image.
	constructor(contour, width = 0, height = 0, cornerPts = [],  center = [], warp = [], rankImg = [],
				bestMatch = 'unknown', rankDiff = 0) {
		this.contour = contor; // Contour of card
		this.width = width; // Width of card
		this.height = height; // Height of card
		this.cornerPts = cornerPts; // Corner points of card
		this.center = center; // Center point of card
		this.warp = warp; // 200 * 300 flattened, grayed, blurred image
		this.rankImg = rankImg; // Thresholded, sized image of card's rank
		this.bestMatch = bestMatch; // Best matched rank
		this.rankDiff = rankDiff; // Difference between rank image and best matched train rank image
	}
}

class TrainRanks {
	// Structure to store information about train rank images.
	constructor(img = []) {
		this.img = img; // Thresholded, sized rank image loaded from hard drive
		this.name = "Placeholder";
	}
}

function loadRanks(filepath = 'train_ranks/') {
	// Loads rank images from directory specified by filepath. Stores
    // them in a list of Train_ranks objects.

    let trainRanks = [];
    let i = 0;

    let cardNames = ['reito_lantern','ornate_kanzashi', 'free_from_the_real', 
              'sakura_tribe_scout', 'plains_ben_thomposon', 'path_of_angers_flame', 
              'sift_through_sands', 'setons_desire', 'phantom_nomad', 
              'divine_light', 'ghostly_wings', 'plains_fred_fields', 'locust_mister',
              'jugan_the_rising_star', 'whispering_shade', 'divergent_growth', 
              'ryusei_the_falling_star', 'dripping_tongue_zubera',
              'ninja_of_the _deep_hours', 'plains_matthew_mitchell', 'plains_greg_staples',
              'forest_quinton_hoover', 'forest_john_avon', 'ghost_lit_refeemer', 
              'kabuto_moth', 'kami_of_false_home', 'waxmane_baku', 'kami_of_tattered_shoji',
              'ethereal_haze', 'joyous_respite', 'orochi_sustainer', 'orochi_ranger',
              'commune_with_nature', 'petalmane_baku', 'scaled_hulk', 'harbinger_of_spring',
              'traproot_kami', 'rending_vines', 'vital_surge', 'torrent_of_stone',
              'descendant_of_soramaro', 'wandering_ones', 'orochi_sustainer', 'field_of_reality'];

    for (card in cardNames) {
    	trainRanks.push(TrainRanks());
    	trainRanks[i].name = cardNames[card];
    	let filename = cardNames[card] + '.jpg';
    	trainRanks[card].img = cv.imread(filepath + filename, cv.IMREAD_GRAYSCALE);
    	i++;
    }
}

function preprocessImage(image, white = false) {
    let dst = new cv.Mat(IM_HEIGHT, IM_WIDTH, cv.CV_8UC4);
    let gray = new cv.Mat(IM_HEIGHT, IM_WIDTH, cv.CV_8UC4);
    let blur = new cv.Mat(IM_HEIGHT, IM_WIDTH, cv.CV_8UC4);
    let thresh = new cv.Mat(IM_HEIGHT, IM_WIDTH, cv.CV_8UC4);
    cv.cvtColor(image, dst, cv.COLOR_BGR2GRAY);
    cv.bitwise_not(dst, gray);
    cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0, 0, cv.BORDER_DEFAULT);

    // The best threshold level depends on the ambient lighting conditions.
    // For bright lighting, a high threshold must be used to isolate the cards
    // from the background. For dim lighting, a low threshold must be used.
    // To make the card detector independent of lighting conditions, the
    // following adaptive threshold method is used.
  
    // A background pixel in the center top of the image is sampled to determine
    // its intensity. The adaptive threshold is set at 50 (THRESH_ADDER) higher
    // than that. This allows the threshold to adapt to the lighting conditions.
    // let a = new nj.array(image.data);
	let bkg_level = gray.data[(gray.cols / 25) * (gray.rows / 2)];
	let thresh_level = bkg_level + BKG_THRESH;

	if(white = true && thresh_level < 110) {
	    thresh_level = 110;
	}

	cv.threshold(blur, thresh, thresh_level, 255, cv.THRESH_BINARY);
	return thresh;
}

function preprocessCard(contour, image) {
    // Uses contour to find information about the query card. Isolates images
    // from the card.

    // Initialize new Query_card object
    let qCard = new QueryCard();
    qCard.contour = contour;

    // Find perimeter of card and use it to approximate corner points
    let peri = cv.arcLength(contour, true);
    let approx = cv.approxPolyDP(contour, 0.01*peri, true);
    let pts = approx.data32S;
    qCard.corner_pts = pts;

    // Find width and height of card's bounding rectangle
    let rect = cv.boundingRect(contour);
    qCard.width = rect.width;
    qCard.height = rect.height;

    // Find center point of card by taking x and y average of the four corners.
    let centX = 0;
    let centY = 0;
    for(let i=0; i < pts.data32S.length - 1; i += 2) {
    	centX += pts.data32S[i];
    	centY += pts.data32S[i+1];
    }
    centX = Math.round(centX / pts.cols);
    centY = Math.round(centY / pts.cols);
    qCard.center = [centX, centY];

    // Warp card into 200x300 flattened image using perspective transform
    qCard.warp = flattener(image, approx, rect.width, rect.height);

    // Find rank contour and bounding rectangle, isolate and find largest contour
    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(qCard.warp, contours, hierarchy, cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE);

    var largestContour = null;
	var largestArea = 0;
	for (let i = 0; i < contours.size(); ++i) {
	    let c = contours.get(i);
	    let area = cv.contourArea(c, false);
	    if (area > largestArea) {
	      largestArea = area;
	      largestContour = c;
	    }
	}

    // Find bounding rectangle for largest contour, use it to resize query rank
    // image to match dimensions of the train rank image
    if (largestContour != null) {
    	let rect = cv.boundingRect(largestContour);
    	let r = new cv.Rect(rect.x, rect.y, rect.x+rect.width, rect.y+rect.height);
    	let qCardRoi = qCard.warp.roi(r); 
    	let qCardSized = cv.resize(qCardRoi, [RANK_WIDTH, RANK_HEIGHT], 0, 0);
        qCard.rankImg = qCardSized;
    }

    return qCard;
}

function matchCard(qCard, trainRanks) {
	// Finds best rank matches for the query card. Differences
    // the query card rank images with the train rank images.
    // The best match is the rank image that has the least difference.

    let bestRankMatchDiff = 3000000;
    let bestRankMatchName = "Unknown";
    let bestRankName = null;

    // If no contours were found in query card in preprocess_card function,
    // the img size is zero, so skip the differencing process
    // (card will be left as Unknown)
    if (qCard.rank_img.length != 0) {
        // Difference the query card rank image from each of the train rank images,
        // and store the result with the least difference
        for (trank in trainRanks) {
        	if (trank.img === null) {
        		continue;
        	}

        	let diffImg = cv.absdiff(qCard.rankImg, trank.img);

        	let rankDiff = Math.round((diffImg.data32S.reduce((a, b) => a + b, 0) / 255);

    		if (rankDiff < bestRankMatchDiff) {
    			bestRankMatchDiff = rankDiff;
    			bestRankName = trank.name;
    		}
        }
    }

  	// Combine best rank match and best suit match to get query card's identity.
    // If the best matches have too high of a difference value, card identity
    // is still Unknown
    if (bestRankMatchDiff < RANK_DIFF_MAX) {
    	bestRankMatchName = bestRankName;
    }

    // Return the identiy of the card and the quality of the suit and rank match
    return [bestRankMatchName, bestRankMatchDiff];
}

function drawResults(image, qCard) {
  	// Draw the card name, center point, and contour on the camera image.

    let x = qCard.center[0];
    let y = qCard.center[1];
    cv.circle(image,(x,y),5,[255,0,0],-1);

    let rankName = qCard.best_rank_match;

    // Draw card name twice, so letters have black outline
    cv.putText(image, [rank_name], [x-60,y-10], font, 1, [0,0,0], 3, cv.LINE_AA);
    cv.putText(image, [rank_name], [x-60,y-10], font, 1, [50,200,200], 2, cv.LINE_AA);
    
    // Can draw difference value for troubleshooting purposes
    // (commented out during normal operation)
    // r_diff = qCard.rank_diff;
    // cv.putText(image, r_diff, [x+20,y+30], font, 0.5, [0,0,255], 1, cv.LINE_AA);

    return image;
}

function findCards(image) {
	// Finds all card-sized contours in a thresholded camera image.
	// Returns the number of cards, and a list of card contours sorted
	// from largest to smallest.
	// Find contours and sort their indices by contour size
	let contours = new cv.MatVector();
	let hierarchy = new cv.Mat();
	cv.findContours(image, contours, hierarchy, cv.RETR_TREE,cv.CHAIN_APPROX_SIMPLE);

    // If there are no contours, do nothing
    // decide if it's white or black border card
	if(contours) {
		let contSizes = [];
		for(let i=0; i < contours.size(); ++i){
			contSizes.push([cv.contourArea(contours.get(i)), i]);
		}
		contSizes = contSizes.sort(sortFunction);

		let constSorted = [];
		let hierSorted = [];
		let contIsCard = [];

		// divide by 4 to create multiple arrays, each for one contour
		let tempHier = [];
		for(let j=0; j < hierarchy.data32S.length; j += 4) {
			tempHier.push(hierarchy.data32S.slice(j, j+4));
		}


		// Fill empty lists with sorted contour and sorted hierarchy. Now,
	    // the indices of the contour list still correspond with those of
	    // the hierarchy list. The hierarchy array can be used to check if
	    // the contours have parents or not.
	    if (contSizes != []) {
		    for (c in contSizes) {
	    		constSorted.push(contours.get(contSizes[c][1]));
	    		hierSorted.push(tempHier[c]);
	    	}
	    }

        // Determine which of the contours are cards by applying the
    	// following criteria: 1) Smaller area than the maximum card size,
    	// 2), bigger area than the minimum card size, 3) have no parents,
    	// and 4) have four corners
    	for(let k=0; k < constSorted.length; k++) {
    		let contour = constSorted[k];
    		let size = cv.contourArea(contour);
            let peri = cv.arcLength(contour,true);
            let approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.01*peri, true);

            if((size < CARD_MAX_AREA) && (size > CARD_MIN_AREA) &&
               (hierSorted[k][3] === -1) && (approx.length)) {
            	contIsCard.push(1);
            } else {
            	contIsCard.push(0);
            }
    	}
    	return [constSorted, contIsCard];

	} else {
		return [[], []];
	}

}

function sortFunction(a, b) {
    if (a[0] === b[0]) {
        return 0;
    }
    else {
        return (a[0] < b[0]) ? -1 : 1;
    }
}

function flattener(image, pts, w, h, pts_arr) {
	// Flattens an image of a card into a top-down 200x300 perspective.
	// Returns the flattened, re-sized, grayed image.
	// See www.pyimagesearch.com/2014/08/25/4-point-opencv-getperspective-transform-example/
	let temp_rect = nj.zeros((4,2), 'float32');
	let s = pts.selection.data;

	let s_sorted = s.sort();
	let tl = s_sorted[0];
	let br = s_sorted[s.length - 1];

	let diff_array = [];
	for(let i = 0; i < s.length - 1; i++) {
	    let diff = Math.abs(s[i] - s[i+1]);
	    diff_array.push(diff);
	}
	let s_diff_array = diff_array.sort();

	let tr = s_diff_array[0];
	let bl = s_diff_array[s.length - 1];

	// Need to create an array listing points in order of
	// [top left, top right, bottom right, bottom left]
	// before doing the perspective transform

	if(w > 0.8 * h) { // If card is vertically oriented
	    temp_rect[0] = tl;
	    temp_rect[1] = tr;
	    temp_rect[2] = br;
	    temp_rect[3] = bl;
	}


	if(w >= 1.2 * h) { // If card is horizontally oriented
	    temp_rect[0] = bl;
	    temp_rect[1] = tl;
	    temp_rect[2] = tr;
	    temp_rect[3] = br;
	}

	// If the card is 'diamond' oriented, a different algorithm
    // has to be used to identify which point is top left, top right
	// bottom left, and bottom right.

	if (w > 0.8*h && w < 1.2*h) { //If card is diamond oriented
	    // If furthest left point is higher than furthest right point,
	    // card is tilted to the left.
	    if (pts_arr[1][0][1] <= pts_arr[3][0][1]) {
	        // If card is titled to the left, approxPolyDP returns points
	        // in this order: top right, top left, bottom left, bottom right
	        temp_rect[0] = pts_arr[1][0]; // Top left
	        temp_rect[1] = pts_arr[0][0]; // Top right
	        temp_rect[2] = pts_arr[3][0]; // Bottom right
	        temp_rect[3] = pts_arr[2][0]; // Bottom left
	    }
	    // If furthest left point is lower than furthest right point,
	    // card is tilted to the right
	    if (pts_arr[1][0][1] > pts_arr[3][0][1]) {
	        // If card is titled to the right, approxPolyDP returns points
	        // in this order: top left, bottom left, bottom right, top right
	        temp_rect[0] = pts_arr[0][0]; // Top left
	        temp_rect[1] = pts_arr[3][0]; // Top right
	        temp_rect[2] = pts_arr[2][0]; // Bottom right
	        temp_rect[3] = pts_arr[1][0]; // Bottom left
	    }
	}

	let maxWidth = 600;
	let maxHeight = 900;
	let dsize = new cv.Size(maxHeight, maxWidth);

	// Create destination array, calculate perspective transform matrix,
	// and warp card image
	let warp = new cv.Mat(video.height, video.width, cv.CV_8UC4);
	let dst = nj.array([[0,0],[maxWidth-1,0],[maxWidth-1,maxHeight-1],[0, maxHeight-1]], 'float32');
	let dstArr = cv.matFromArray(4, 2, cv.CV_32F, dst);
	let rect = cv.matFromArray(4, 2, cv.CV_32F, temp_rect);

	let M = cv.getPerspectiveTransform(rect, dstArr);
	cv.warpPerspective(image, warp, M, dsize);
	cv.cvtColor(warp, warp, cv.COLOR_BGR2GRAY);
	return warp;
}