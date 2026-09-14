import { redirect } from 'next/navigation'
import { currentUser, staff } from './auth'
export async function pageUser(area:'staff'|'customer'|'hotel') {
  const user=await currentUser();if(!user)redirect('/login')
  if(area==='staff'&&!staff(user))redirect(user.hotel_id?'/hotel':'/customer')
  if(area==='hotel'&&!user.hotel_id)redirect(staff(user)?'/dashboard':'/customer')
  return user
}
