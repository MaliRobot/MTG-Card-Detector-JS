
const IM_WIDTH = 800;
const IM_HEIGHT = 600; 

const BKG_THRESH = 60;

const RANK_DIFF_MAX = 200000;

const CARD_MAX_AREA = 300000;
const CARD_MIN_AREA = 60000;

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

		// Fill empty lists with sorted contour and sorted hierarchy. Now,
	    // the indices of the contour list still correspond with those of
	    // the hierarchy list. The hierarchy array can be used to check if
	    // the contours have parents or not.
	    if (contSizes != []) {
		    for (c in contSizes) {
	    		constSorted.push(contours.get(contSizes[c][1]));
	    		// divide hier by contSizes length and chose i-th slice
	    		// hierSorted.push(i * (hierarchy.data.length / contSizes.length))
	    	}
			console.log(hierarchy, contSizes.length);
	    }


	} else {
		return [];
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