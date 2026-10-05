import {useState} from 'react';

export function CreatorAvatar({name,image,size='medium'}:{name:string;image?:string;size?:'small'|'medium'|'large'}){
  const [failedImage,setFailedImage]=useState<string>();
  return <span className={`creator-profile-avatar avatar-${size}`}>{image&&image!==failedImage?<img src={image} alt={`${name} 프로필 아이콘`} onError={()=>setFailedImage(image)}/>:Array.from(name)[0]}</span>;
}
